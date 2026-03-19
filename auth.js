#!/usr/bin/env node
/**
 * Generate OAuth token for Google Classroom API
 * Run: node auth.js
 * 
 * Prerequisites:
 * 1. Enable Classroom API: gcloud services enable classroom.googleapis.com
 * 2. Create OAuth credentials (Desktop app) in Google Cloud Console
 * 3. Download credentials JSON -> save as ./credentials.json
 * 4. Run this script to generate token.json
 */

import { google } from 'googleapis';
import fs from 'fs';
import readline from 'readline';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses',
  'https://www.googleapis.com/auth/classroom.coursework.students',
  'https://www.googleapis.com/auth/classroom.coursework.me',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials',
  'https://www.googleapis.com/auth/classroom.announcements',
  'https://www.googleapis.com/auth/classroom.rosters',
  'https://www.googleapis.com/auth/classroom.topics',
  'https://www.googleapis.com/auth/classroom.guardianlinks.students',
  'https://www.googleapis.com/auth/classroom.profile.emails',
  'https://www.googleapis.com/auth/classroom.profile.photos',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly', // per descarregar submissions d'alumnes
];

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

async function authorize() {
  // Check if credentials.json exists
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('❌ Error: credentials.json not found');
    console.error('\nTo get credentials:');
    console.error('1. Go to https://console.cloud.google.com');
    console.error('2. Enable Classroom API: gcloud services enable classroom.googleapis.com');
    console.error('3. APIs & Services → Credentials → Create Credentials → OAuth client ID');
    console.error('4. Application type: Desktop app');
    console.error('5. Download JSON → save as credentials.json');
    console.error('6. Run this script again: node auth.js');
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Check if we already have a token
  if (fs.existsSync(TOKEN_PATH)) {
    console.log('✅ Token already exists at:', TOKEN_PATH);
    console.log('Delete token.json if you want to re-authenticate.');
    
    // Test the token
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    oAuth2Client.setCredentials(token);
    
    try {
      const classroom = google.classroom({ version: 'v1', auth: oAuth2Client });
      const response = await classroom.courses.list({ pageSize: 1 });
      console.log('✅ Token is valid!');
      console.log(`Found ${response.data.courses?.length || 0} course(s)`);
      return;
    } catch (error) {
      console.log('⚠️  Token expired or invalid, generating new one...');
      fs.unlinkSync(TOKEN_PATH);
    }
  }

  // Generate auth URL
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });

  console.log('\n📋 Steps to authorize:');
  console.log('1. Open this URL in your browser:');
  console.log('\n   ', authUrl, '\n');
  console.log('2. Sign in with your Google account (must have Classroom access)');
  console.log('3. Copy the authorization code from the browser');
  console.log('4. Paste it below\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Enter the authorization code: ', async (code) => {
    rl.close();
    
    try {
      const { tokens } = await oAuth2Client.getToken(code);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      console.log('\n✅ Token saved to:', TOKEN_PATH);
      console.log('✅ You can now use the classroom-mcp server in Cursor!');
      
      // Test the token
      oAuth2Client.setCredentials(tokens);
      const classroom = google.classroom({ version: 'v1', auth: oAuth2Client });
      const response = await classroom.courses.list({ pageSize: 1 });
      console.log(`✅ Successfully connected to Google Classroom`);
      console.log(`Found ${response.data.courses?.length || 0} course(s)`);
    } catch (error) {
      console.error('\n❌ Error retrieving token:', error.message);
      console.error('Please make sure you copied the entire code and try again.');
    }
  });
}

authorize().catch(console.error);
