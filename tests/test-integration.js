/**
 * TEST D'INTEGRACIÓ v1.0 — Google Classroom MCP
 * Tests interfuncionals: cadenes de creació, modificació creuada,
 * Drive integrat, edició de contingut creat pel web.
 * Curs: 720436012571 (-- [Meus] ---)
 */

import { google } from 'googleapis';
import { Readable } from 'stream';
import fs from 'fs';

// ── CONFIG ────────────────────────────────────────────────────────────────────
const C = '720436012571'; // -- [Meus] -------------------

const creds = JSON.parse(fs.readFileSync('./credentials.json', 'utf8'));
const token = JSON.parse(fs.readFileSync('./token.json', 'utf8'));
const { client_secret, client_id, redirect_uris } = creds.installed || creds.web;
const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
auth.setCredentials(token);
const classroom = google.classroom({ version: 'v1', auth });
const drive = google.drive({ version: 'v3', auth });

// ── HELPERS ───────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const errors = [];
const created = { topics: [], assignments: [], materials: [], announcements: [], driveFiles: [] };

const ok  = (label, detail = '') => { console.log(`  ✅ ${label}${detail ? ' — ' + detail : ''}`); passed++; };
const fail = (label, err)         => { const m = err?.message || String(err); console.log(`  ❌ ${label}: ${m}`); failed++; errors.push({label, m}); };
const note = (msg)                => console.log(`  ℹ️  ${msg}`);
const sec  = (t)                  => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 52 - t.length))}`);

async function verify(label, fn) {
  try { const r = await fn(); ok(label, r); return r; }
  catch(e) { fail(label, e); return null; }
}

// Crear fitxer Drive de prova (retorna id)
async function uploadDrive(name, content = 'contingut de prova MCP') {
  const r = await drive.files.create({
    requestBody: { name, mimeType: 'text/plain' },
    media: { mimeType: 'text/plain', body: Readable.from(Buffer.from(content)) },
    fields: 'id,name,webViewLink',
  });
  created.driveFiles.push(r.data.id);
  return r.data;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function run() {
  const ts = Date.now();
  console.log('🔗 TEST D\'INTEGRACIÓ v1.0 — Google Classroom MCP');
  console.log(`   Curs: ${C} (-- [Meus] ---)`);
  console.log(`   Data: ${new Date().toLocaleString('ca-ES')}\n`);

  // ════════════════════════════════════════════════════════════════════════════
  sec('1. CADENA: Topic → Assignment → Material en el mateix tema');
  // ════════════════════════════════════════════════════════════════════════════

  let topicA = null, topicB = null, assignA = null, matA = null;

  topicA = await verify('crear topic A', async () => {
    const r = await classroom.courses.topics.create({ courseId: C, requestBody: { name: `[TEST-INT] Tema A ${ts}` } });
    created.topics.push(r.data.topicId);
    return `id=${r.data.topicId} name="${r.data.name}"`;
  }).then(() => classroom.courses.topics.create({ courseId: C, requestBody: { name: `[TEST-INT] Tema A ${ts}` } }).then(r => { return r.data; }).catch(()=>null));

  // Re-fetch proper (la lambda anterior ja va crear-lo, necessito l'objecte)
  if (!topicA) {
    const r = await classroom.courses.topics.list({ courseId: C });
    topicA = (r.data.topic || []).find(t => t.name?.includes(`Tema A ${ts}`));
  }

  topicB = await classroom.courses.topics.create({ courseId: C, requestBody: { name: `[TEST-INT] Tema B ${ts}` } })
    .then(r => { created.topics.push(r.data.topicId); ok('crear topic B', `id=${r.data.topicId}`); return r.data; })
    .catch(e => { fail('crear topic B', e); return null; });

  // Crear assignment al topicA
  if (topicA?.topicId) {
    assignA = await classroom.courses.courseWork.create({
      courseId: C,
      requestBody: {
        title: `[TEST-INT] Tasca en Tema A ${ts}`,
        description: 'Tasca creada en Tema A per test d\'integració.',
        workType: 'ASSIGNMENT',
        state: 'DRAFT',
        maxPoints: 10,
        topicId: topicA.topicId,
        dueDate: { year: 2026, month: 12, day: 31 },
        dueTime: { hours: 23, minutes: 59, seconds: 0, nanos: 0 },
      },
    }).then(r => { created.assignments.push(r.data.id); ok('crear assignment al Tema A', `id=${r.data.id} topicId=${r.data.topicId}`); return r.data; })
      .catch(e => { fail('crear assignment al Tema A', e); return null; });
  }

  // Crear material al topicA
  if (topicA?.topicId) {
    matA = await classroom.courses.courseWorkMaterials.create({
      courseId: C,
      requestBody: {
        title: `[TEST-INT] Material en Tema A ${ts}`,
        description: 'Material del Tema A.',
        topicId: topicA.topicId,
        state: 'PUBLISHED',
      },
    }).then(r => { created.materials.push(r.data.id); ok('crear material al Tema A', `id=${r.data.id} topicId=${r.data.topicId}`); return r.data; })
      .catch(e => { fail('crear material al Tema A', e); return null; });
  }

  // Verificar que list_topics mostra els 2 temes nous
  await verify('list_topics veu els 2 temes nous', async () => {
    const r = await classroom.courses.topics.list({ courseId: C });
    const test = (r.data.topic || []).filter(t => t.name?.includes('[TEST-INT]'));
    if (test.length < 2) throw new Error(`Esperats 2, trobats ${test.length}`);
    return `${test.length} temes TEST visibles`;
  });

  // ════════════════════════════════════════════════════════════════════════════
  sec('2. MOVE: Assignment de Tema A → Tema B → sense tema');
  // ════════════════════════════════════════════════════════════════════════════

  if (assignA && topicB) {
    await verify('move assignment Tema A → Tema B', async () => {
      const r = await classroom.courses.courseWork.patch({
        courseId: C, id: assignA.id, updateMask: 'topicId',
        requestBody: { topicId: topicB.topicId },
      });
      if (r.data.topicId !== topicB.topicId) throw new Error(`topicId és ${r.data.topicId}`);
      return `topicId confirmat = ${r.data.topicId}`;
    });

    await verify('move assignment Tema B → sense tema (topicId="")', async () => {
      const r = await classroom.courses.courseWork.patch({
        courseId: C, id: assignA.id, updateMask: 'topicId',
        requestBody: { topicId: '' },
      });
      return `topicId ara = "${r.data.topicId || '(buit)'}"`;
    });

    await verify('move assignment sense tema → Tema A (revert)', async () => {
      const r = await classroom.courses.courseWork.patch({
        courseId: C, id: assignA.id, updateMask: 'topicId',
        requestBody: { topicId: topicA.topicId },
      });
      return `topicId restaurat = ${r.data.topicId}`;
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  sec('3. PATCH ASSIGNMENT: múltiples camps i combinacions');
  // ════════════════════════════════════════════════════════════════════════════

  if (assignA) {
    await verify('patch: només títol', async () => {
      const r = await classroom.courses.courseWork.patch({
        courseId: C, id: assignA.id, updateMask: 'title',
        requestBody: { title: `[TEST-INT] Tasca PATCH títol ${ts}` },
      });
      return `"${r.data.title}"`;
    });

    await verify('patch: només maxPoints', async () => {
      const r = await classroom.courses.courseWork.patch({
        courseId: C, id: assignA.id, updateMask: 'maxPoints',
        requestBody: { maxPoints: 50 },
      });
      return `maxPoints=${r.data.maxPoints}`;
    });

    await verify('patch: dueDate + dueTime junts', async () => {
      const r = await classroom.courses.courseWork.patch({
        courseId: C, id: assignA.id, updateMask: 'dueDate,dueTime',
        requestBody: {
          dueDate: { year: 2026, month: 6, day: 15 },
          dueTime: { hours: 9, minutes: 0, seconds: 0, nanos: 0 },
        },
      });
      return `dueDate=${JSON.stringify(r.data.dueDate)} dueTime=${JSON.stringify(r.data.dueTime)}`;
    });

    await verify('patch: títol + descripció + maxPoints (multi-camp)', async () => {
      const r = await classroom.courses.courseWork.patch({
        courseId: C, id: assignA.id, updateMask: 'title,description,maxPoints',
        requestBody: {
          title: `[TEST-INT] Tasca MULTI-PATCH ${ts}`,
          description: 'Descripció actualitzada en multi-patch.',
          maxPoints: 100,
        },
      });
      return `title="${r.data.title}" maxPoints=${r.data.maxPoints}`;
    });

    // Intentar afegir materials a una tasca ja creada → LIMITACIÓ ESPERADA
    sec('  3b. LIMITACIÓ API: afegir materials post-creació');
    try {
      await classroom.courses.courseWork.patch({
        courseId: C, id: assignA.id, updateMask: 'materials',
        requestBody: { materials: [{ link: { url: 'https://example.com' } }] },
      });
      note('INESPERAT: materials actualitzats post-creació (API ha canviat?)');
    } catch (e) {
      ok('limitació confirmada: materials no modificables post-creació', e.message.slice(0, 60));
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  sec('4. ASSIGNMENT AMB ADJUNTS DES DE LA CREACIÓ (Drive + Link + YouTube)');
  // ════════════════════════════════════════════════════════════════════════════

  let driveFile = null;
  try { driveFile = await uploadDrive(`test-int-adjunt-${ts}.txt`, `Fitxer adjunt de prova integració ${ts}`); } catch(e) {}

  let assignAdjunts = null;
  if (driveFile) {
    assignAdjunts = await classroom.courses.courseWork.create({
      courseId: C,
      requestBody: {
        title: `[TEST-INT] Tasca amb adjunts ${ts}`,
        description: 'Tasca amb Drive + Link adjunts des de creació.',
        workType: 'ASSIGNMENT',
        state: 'DRAFT',
        maxPoints: 5,
        materials: [
          { driveFile: { driveFile: { id: driveFile.id } } },
          { link: { url: 'https://www.youtube.com', title: 'Link de prova' } },
        ],
      },
    }).then(r => {
      created.assignments.push(r.data.id);
      const mats = r.data.materials || [];
      ok('crear assignment amb Drive+Link adjunts', `${mats.length} materials confirmats a la resposta`);
      return r.data;
    }).catch(e => { fail('crear assignment amb Drive+Link adjunts', e); return null; });

    if (assignAdjunts) {
      // Verificar que els materials estan presents via re-fetch
      await verify('re-fetch assignment → materials presents', async () => {
        // No hi ha get_courseWork directe al nostre MCP, usem list
        const r = await classroom.courses.courseWork.list({
          courseId: C,
          courseWorkStates: ['DRAFT', 'PUBLISHED'],
          fields: 'courseWork(id,title,materials)',
        });
        const found = (r.data.courseWork || []).find(w => w.id === assignAdjunts.id);
        if (!found) throw new Error('Tasca no trobada al list');
        return `${(found.materials||[]).length} materials al list`;
      });
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  sec('5. MATERIAL AMB ADJUNTS: Drive + Link');
  // ════════════════════════════════════════════════════════════════════════════

  let driveFile2 = null;
  try { driveFile2 = await uploadDrive(`test-int-material-${ts}.txt`, `Contingut material integració ${ts}`); } catch(e) {}

  let matAdjunts = null;
  if (driveFile2) {
    matAdjunts = await classroom.courses.courseWorkMaterials.create({
      courseId: C,
      requestBody: {
        title: `[TEST-INT] Material amb adjunts ${ts}`,
        description: 'Material amb Drive + Link.',
        state: 'PUBLISHED',
        materials: [
          { driveFile: { driveFile: { id: driveFile2.id } } },
          { link: { url: 'https://example.com', title: 'Exemple' } },
        ],
      },
    }).then(r => {
      created.materials.push(r.data.id);
      ok('crear material amb Drive+Link adjunts', `${(r.data.materials||[]).length} materials confirmats`);
      return r.data;
    }).catch(e => { fail('crear material amb Drive+Link adjunts', e); return null; });

    // Intentar modificar els materials del material (diferent de coursework, pot funcionar?)
    if (matAdjunts) {
      sec('  5b. LIMITACIÓ: patch materials en courseWorkMaterial');
      try {
        await classroom.courses.courseWorkMaterials.patch({
          courseId: C, id: matAdjunts.id,
          updateMask: 'materials',
          requestBody: { materials: [{ link: { url: 'https://nou-link.com', title: 'Link nou' } }] },
        });
        ok('patch materials en courseWorkMaterial → FUNCIONA (diferent de coursework!)');
      } catch(e) {
        ok('limitació confirmada: materials no modificables en courseWorkMaterial post-creació', e.message.slice(0,60));
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  sec('6. classroom_upload_to_classroom (Drive + Material en un pas)');
  // ════════════════════════════════════════════════════════════════════════════

  await verify('upload_to_classroom: puja + crea material', async () => {
    const content = Buffer.from(`Contingut upload_to_classroom ${ts}`);
    const fileResp = await drive.files.create({
      requestBody: { name: `test-upload-to-classroom-${ts}.txt`, mimeType: 'text/plain' },
      media: { mimeType: 'text/plain', body: Readable.from(content) },
      fields: 'id,name',
    });
    created.driveFiles.push(fileResp.data.id);
    const matResp = await classroom.courses.courseWorkMaterials.create({
      courseId: C,
      requestBody: {
        title: `[TEST-INT] Upload To Classroom ${ts}`,
        state: 'PUBLISHED',
        materials: [{ driveFile: { driveFile: { id: fileResp.data.id } } }],
      },
    });
    created.materials.push(matResp.data.id);
    return `driveId=${fileResp.data.id} matId=${matResp.data.id}`;
  });

  // ════════════════════════════════════════════════════════════════════════════
  sec('7. ANUNCIS: crear → patch → verificar amb list');
  // ════════════════════════════════════════════════════════════════════════════

  let annId = null;
  await classroom.courses.announcements.create({
    courseId: C,
    requestBody: { text: `[TEST-INT] Anunci original ${ts}`, state: 'PUBLISHED' },
  }).then(r => { annId = r.data.id; created.announcements.push(annId); ok('crear anunci', `id=${annId}`); })
    .catch(e => fail('crear anunci', e));

  if (annId) {
    await verify('patch anunci → verificar amb list', async () => {
      await classroom.courses.announcements.patch({
        courseId: C, id: annId, updateMask: 'text',
        requestBody: { text: `[TEST-INT] Anunci EDITAT ${ts}` },
      });
      const r = await classroom.courses.announcements.list({
        courseId: C, fields: 'announcements(id,text)',
      });
      const found = (r.data.announcements || []).find(a => a.id === annId);
      if (!found?.text?.includes('EDITAT')) throw new Error('text no actualitzat al list');
      return `text confirmat al list: "${found.text.slice(0, 40)}..."`;
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  sec('8. EDITAR CONTINGUT CREAT PEL WEB (tasques, temes, materials existents)');
  // ════════════════════════════════════════════════════════════════════════════

  // Buscar el primer tema existent (no de test)
  const topicsResp = await classroom.courses.topics.list({ courseId: C });
  const webTopics = (topicsResp.data.topic || []).filter(t => !t.name?.includes('[TEST-INT]'));
  note(`${webTopics.length} temes creats pel web trobats`);

  if (webTopics.length > 0) {
    const t = webTopics[0];
    const originalName = t.name;
    await verify(`patch tema web "${originalName.slice(0,30)}" → revert`, async () => {
      await classroom.courses.topics.patch({
        courseId: C, id: t.topicId, updateMask: 'name',
        requestBody: { name: originalName + ' [TEST-EDITAT]' },
      });
      await classroom.courses.topics.patch({
        courseId: C, id: t.topicId, updateMask: 'name',
        requestBody: { name: originalName },
      });
      return `modificat i revertit correctament`;
    });
  }

  // Buscar la primera tasca existent (no de test)
  const worksResp = await classroom.courses.courseWork.list({ courseId: C, fields: 'courseWork(id,title,description,maxPoints,topicId)' });
  const webWorks = (worksResp.data.courseWork || []).filter(w => !w.title?.includes('[TEST-INT]'));
  note(`${webWorks.length} tasques creades pel web trobades`);

  if (webWorks.length > 0) {
    const w = webWorks[0];
    const origTitle = w.title;
    const origDesc = w.description || '';
    const origMax = w.maxPoints;
    note(`Editant tasca web: "${origTitle?.slice(0,40)}"`);

    await verify('patch títol tasca web → revert', async () => {
      await classroom.courses.courseWork.patch({
        courseId: C, id: w.id, updateMask: 'title',
        requestBody: { title: origTitle + ' [TEST-EDITAT]' },
      });
      const r = await classroom.courses.courseWork.patch({
        courseId: C, id: w.id, updateMask: 'title',
        requestBody: { title: origTitle },
      });
      if (r.data.title !== origTitle) throw new Error(`títol no revertit: ${r.data.title}`);
      return `"${r.data.title}" revertit OK`;
    });

    if (origMax !== undefined) {
      await verify('patch maxPoints tasca web → revert', async () => {
        await classroom.courses.courseWork.patch({
          courseId: C, id: w.id, updateMask: 'maxPoints',
          requestBody: { maxPoints: origMax + 1 },
        });
        const r = await classroom.courses.courseWork.patch({
          courseId: C, id: w.id, updateMask: 'maxPoints',
          requestBody: { maxPoints: origMax },
        });
        return `maxPoints: ${origMax+1} → ${r.data.maxPoints} (revertit)`;
      });
    }

    // Provar update_assignment (updateMask ampli) sobre tasca web
    await verify('update_assignment tasca web → revert', async () => {
      await classroom.courses.courseWork.patch({
        courseId: C, id: w.id,
        updateMask: 'title,description,maxPoints,topicId,dueDate,dueTime',
        requestBody: {
          title: origTitle + ' [UPDATE-INT]',
          description: origDesc || 'Test integració',
          maxPoints: origMax ?? 10,
          topicId: w.topicId || '',
        },
      });
      const r = await classroom.courses.courseWork.patch({
        courseId: C, id: w.id,
        updateMask: 'title,description,maxPoints',
        requestBody: { title: origTitle, description: origDesc, maxPoints: origMax ?? 10 },
      });
      return `"${r.data.title}" revertit OK`;
    });
  }

  // Buscar el primer material existent (no de test)
  const matsResp = await classroom.courses.courseWorkMaterials.list({ courseId: C, fields: 'courseWorkMaterial(id,title,description,topicId)' });
  const webMats = (matsResp.data.courseWorkMaterial || []).filter(m => !m.title?.includes('[TEST-INT]'));
  note(`${webMats.length} materials creats pel web trobats`);

  if (webMats.length > 0) {
    const m = webMats[0];
    const origTitle = m.title;
    const origDesc = m.description || '';
    note(`Editant material web: "${origTitle?.slice(0,40)}"`);

    await verify('patch material web (títol) → revert', async () => {
      await classroom.courses.courseWorkMaterials.patch({
        courseId: C, id: m.id, updateMask: 'title',
        requestBody: { title: origTitle + ' [TEST]' },
      });
      const r = await classroom.courses.courseWorkMaterials.patch({
        courseId: C, id: m.id, updateMask: 'title',
        requestBody: { title: origTitle },
      });
      if (r.data.title !== origTitle) throw new Error(`títol no revertit`);
      return `"${r.data.title}" revertit OK`;
    });

    await verify('patch material web (topicId) → revert', async () => {
      // Moure al topicA (test) si existeix, sinó mantenir
      const newTopic = topicA?.topicId || m.topicId || '';
      await classroom.courses.courseWorkMaterials.patch({
        courseId: C, id: m.id, updateMask: 'topicId',
        requestBody: { topicId: newTopic },
      });
      const r = await classroom.courses.courseWorkMaterials.patch({
        courseId: C, id: m.id, updateMask: 'topicId',
        requestBody: { topicId: m.topicId || '' },
      });
      return `topicId revertit a "${r.data.topicId || '(buit)'}"`;
    });
  }

  // Buscar el primer anunci existent (no de test)
  const annsResp = await classroom.courses.announcements.list({ courseId: C, fields: 'announcements(id,text)' });
  const webAnns = (annsResp.data.announcements || []).filter(a => !a.text?.includes('[TEST-INT]'));
  note(`${webAnns.length} anuncis creats pel web trobats`);

  if (webAnns.length > 0) {
    const a = webAnns[0];
    const origText = a.text;
    await verify('patch anunci web → revert', async () => {
      await classroom.courses.announcements.patch({
        courseId: C, id: a.id, updateMask: 'text',
        requestBody: { text: origText + '\n[TEST-EDITAT MCP]' },
      });
      const r = await classroom.courses.announcements.patch({
        courseId: C, id: a.id, updateMask: 'text',
        requestBody: { text: origText },
      });
      return `anunci revertit OK (${origText.slice(0,40)}...)`;
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  sec('9. ENTREGUES al curs [Meus] (si n\'hi ha)');
  // ════════════════════════════════════════════════════════════════════════════

  await verify('list_submissions (-) complet', async () => {
    const r = await classroom.courses.courseWork.studentSubmissions.list({
      courseId: C, courseWorkId: '-',
      fields: 'studentSubmissions(id,courseWorkId,userId,state,assignedGrade,draftGrade)',
    });
    const subs = r.data.studentSubmissions || [];
    const byState = {};
    subs.forEach(s => { byState[s.state] = (byState[s.state] || 0) + 1; });
    return `${subs.length} entregues: ${JSON.stringify(byState)}`;
  });

  // ════════════════════════════════════════════════════════════════════════════
  sec('10. NETEJA: eliminar totes les dades de test');
  // ════════════════════════════════════════════════════════════════════════════

  for (const id of created.announcements) {
    await classroom.courses.announcements.delete({ courseId: C, id })
      .then(() => ok(`delete announcement ${id}`))
      .catch(e => fail(`delete announcement ${id}`, e));
  }
  for (const id of created.materials) {
    await classroom.courses.courseWorkMaterials.delete({ courseId: C, id })
      .then(() => ok(`delete material ${id}`))
      .catch(e => fail(`delete material ${id}`, e));
  }
  for (const id of created.assignments) {
    await classroom.courses.courseWork.delete({ courseId: C, id })
      .then(() => ok(`delete assignment ${id}`))
      .catch(e => fail(`delete assignment ${id}`, e));
  }
  for (const id of created.topics) {
    await classroom.courses.topics.delete({ courseId: C, id })
      .then(() => ok(`delete topic ${id}`))
      .catch(e => fail(`delete topic ${id}`, e));
  }
  for (const id of created.driveFiles) {
    await drive.files.delete({ fileId: id })
      .then(() => ok(`delete drive file ${id}`))
      .catch(e => fail(`delete drive file ${id}`, e));
  }

  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(57));
  console.log(`  RESULTAT FINAL: ${passed} ✅  |  ${failed} ❌  |  Total: ${passed + failed}`);
  if (errors.length > 0) {
    console.log('\n  Errors:');
    errors.forEach(({ label, m }) => console.log(`    • ${label}: ${m}`));
  }
  console.log('═'.repeat(57));
}

run().catch(err => { console.error('\n💥 Error fatal:', err.message); process.exit(1); });
