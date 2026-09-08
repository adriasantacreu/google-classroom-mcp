import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Load the built class without starting stdio or accessing credentials.
const source = fs.readFileSync(new URL('../dist/index.js', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('class GoogleClassroomServer'), source.indexOf('const server = new GoogleClassroomServer'));
const Server = vm.runInNewContext(body + '\nGoogleClassroomServer');
const server = Object.create(Server.prototype);
for (const [name, api, key, state] of [
  ['classroom_list_assignments', 'courseWork', 'courseWork', 'courseWorkStates'],
  ['classroom_list_materials', 'courseWorkMaterials', 'courseWorkMaterial', 'courseWorkMaterialStates'],
  ['classroom_list_announcements', 'announcements', 'announcements', 'announcementStates'],
  ['classroom_list_topics', 'topics', 'topic'],
]) {
  for (const fullData of [false, true]) {
    let calls = 0;
    const args = { courseId: 'test', pageSize: 1, fullData };
    if (fullData && state) args[state] = ['PUBLISHED', 'DRAFT'];
    const classroom = { courses: { [api]: { list: async params => {
      assert.equal(params.pageToken, [undefined, 'second', 'third'][calls]);
      if (state) assert.equal(params[state], args[state]);
      if (api !== 'topics') {
        assert.equal(params.pageSize, 1);
        if (fullData) assert.equal(params.fields, undefined);
        else assert(params.fields.includes('nextPageToken'));
      }
      // An empty intermediate page must not end traversal.
      return { data: [
        { [key]: [{ id: 'first' }], nextPageToken: 'second' },
        { nextPageToken: 'third' },
        { [key]: [{ id: 'last' }] },
      ][calls++] };
    } } } };
    const result = await server.handleToolCall(classroom, {}, name, args);
    assert.deepEqual(JSON.parse(result.content[0].text), [{ id: 'first' }, { id: 'last' }]);
    assert.equal(calls, 3);
  }
  const empty = { courses: { [api]: { list: async () => ({ data: {} }) } } };
  assert.deepEqual(JSON.parse((await server.handleToolCall(empty, {}, name, { courseId: 'test' })).content[0].text), []);
  const failing = { courses: { [api]: { list: async () => { throw new Error('API failed'); } } } };
  await assert.rejects(server.handleToolCall(failing, {}, name, { courseId: 'test' }), /API failed/);
  if (state) assert(server.getTools().find(tool => tool.name === name).inputSchema.properties[state]);
}
let resumed = false;
await server.handleToolCall({ courses: { courseWork: { list: async params => {
  assert.equal(params.pageToken, 'resume');
  resumed = true;
  return { data: {} };
} } } }, {}, 'classroom_list_assignments', { courseId: 'test', pageToken: 'resume' });
assert(resumed);
console.log('Pagination regression checks passed.');
