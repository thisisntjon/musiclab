import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayFlow} from '../../../static/ui/stages/play_flow.js';

test('valid unchanged band remains playable on every comparison redraw',()=>{
  const flow=Object.create(PlayFlow.prototype),buttons=[];
  flow.partComparison={kind:'band',index:0,sceneId:'reggae-v1',changed:false,
    requestedId:'request',candidates:{request:{doc:{},trial:{}}}};
  flow._btn=(key,label,classes,attributes='')=>{buttons.push({key,label,attributes});return '';};
  for(let redraw=0;redraw<2;redraw++){
    buttons.length=0;
    const html=flow._comparisonHtml();
    assert.equal(buttons.find(b=>b.key==='compare-alternative').attributes,'');
    assert.equal(buttons.length,5);
    assert.match(html,/>Next band<\/label>/);
  }
  delete flow.partComparison.candidates.request;
  buttons.length=0;flow._comparisonHtml();
  assert.equal(buttons.find(b=>b.key==='compare-alternative').attributes,'disabled');
});

test('Enter on part wheel never activates a previously scanned Play control',()=>{
  const priorDocument=globalThis.document;
  let clicks=0,prevented=0,stopped=0;
  const wheel={matches:selector=>selector==='[data-part-circle]'};
  globalThis.document={activeElement:wheel,getElementById:()=>null};
  try {
    const flow=Object.create(PlayFlow.prototype);
    flow.root={style:{display:'block'},contains:()=>true};
    flow.stage='song';flow.scan={index:0};
    flow._scanItems=()=>[{click(){clicks++;}}];
    flow._onKey({key:'Enter',target:wheel,preventDefault(){prevented++;},stopImmediatePropagation(){stopped++;}});
    assert.equal(clicks,0);
    assert.equal(prevented,1);
    assert.equal(stopped,1);
  } finally {
    if(priorDocument===undefined)delete globalThis.document;
    else globalThis.document=priorDocument;
  }
});
