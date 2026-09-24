type OptimizerReview={reviewCardId:string;rating:'again'|'hard'|'good'|'easy';answeredAt:string};
export function buildOptimizerTrainingData(reviews:OptimizerReview[]){
  const groups=new Map<string,OptimizerReview[]>();for(const review of reviews){const group=groups.get(review.reviewCardId)??[];group.push(review);groups.set(review.reviewCardId,group);}
  const ratings:number[]=[];const deltaTs:number[]=[];const lengths:number[]=[];const cardIds:bigint[]=[];let cardNumber=BigInt(0);
  for(const group of [...groups.values()].map(items=>items.sort((a,b)=>a.answeredAt.localeCompare(b.answeredAt)))){let previous:Date|null=null;lengths.push(group.length);for(const review of group){const at=new Date(review.answeredAt);ratings.push({again:1,hard:2,good:3,easy:4}[review.rating]);deltaTs.push(previous?Math.max(0,Math.round((at.getTime()-previous.getTime())/86_400_000)):0);cardIds.push(cardNumber);previous=at;}cardNumber+=BigInt(1);}
  return {ratings:new Uint32Array(ratings),deltaTs:new Uint32Array(deltaTs),lengths:new Uint32Array(lengths),cardIds:new BigInt64Array(cardIds)};
}

export async function optimizeFsrsParameters(reviews:OptimizerReview[], options: { numRelearningSteps: number }){
  const {computeParameters,FSRSBindingItem,FSRSBindingReview}=await import('@open-spaced-repetition/binding');const training=buildOptimizerTrainingData(reviews);let offset=0;
  const items=[...training.lengths].map(length=>{const sequence=[];for(let index=0;index<length;index+=1){sequence.push(new FSRSBindingReview(training.ratings[offset],training.deltaTs[offset]));offset+=1;}return new FSRSBindingItem(sequence);});
  return computeParameters(items,{enableShortTerm:true,numRelearningSteps:options.numRelearningSteps,timeout:300});
}
