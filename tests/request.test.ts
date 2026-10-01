import assert from 'node:assert/strict';
import {test} from 'node:test';
import {isSameOrigin} from '../lib/request';
test('CSRF origin uses the external host even behind the Next dev bind host',()=>{
  assert.equal(isSameOrigin(new Request('http://0.0.0.0:3000/api/planner',{headers:{origin:'http://localhost:3000',host:'localhost:3000'}})),true);
  assert.equal(isSameOrigin(new Request('https://planner.example/api/planner',{headers:{origin:'https://evil.example',host:'planner.example'}})),false);
  assert.equal(isSameOrigin(new Request('https://planner.example/api/planner',{headers:{host:'planner.example'}})),false);
});
