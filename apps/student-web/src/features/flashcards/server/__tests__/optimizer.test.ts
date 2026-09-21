import {buildOptimizerTrainingData} from '../optimizer';
it('builds deterministic per-card FSRS training sequences',()=>{const result=buildOptimizerTrainingData([
  {reviewCardId:'b',rating:'good',answeredAt:'2026-09-03T00:00:00Z'},{reviewCardId:'a',rating:'again',answeredAt:'2026-09-01T00:00:00Z'},{reviewCardId:'a',rating:'easy',answeredAt:'2026-09-03T00:00:00Z'}]);
  expect([...result.ratings]).toEqual([3,1,4]);expect([...result.deltaTs]).toEqual([0,0,2]);expect([...result.lengths]).toEqual([1,2]);
});
