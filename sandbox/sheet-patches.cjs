'use strict';
function changedRuns(before,after){const runs=[];for(let col=0;col<after.length;col++){if(JSON.stringify(before[col]?.userEnteredValue||{})===JSON.stringify(after[col]?.userEnteredValue||{}))continue;const last=runs.at(-1);if(last&&last.start+last.values.length===col)last.values.push(after[col]);else runs.push({start:col,values:[after[col]]});}return runs;}
module.exports={changedRuns};
