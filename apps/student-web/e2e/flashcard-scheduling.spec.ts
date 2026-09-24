import {expect,test,type Page} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';

const flashcardId='fae20000-0000-4000-8000-000000000001';
const admin=()=>createClient(process.env.STUDENT_E2E_SUPABASE_URL!,process.env.STUDENT_E2E_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
async function deleteFixture(){const client=admin();const {data:reviewCards,error:reviewCardsError}=await client.from('flashcard_review_cards').select('id').eq('flashcard_id',flashcardId);if(reviewCardsError)throw reviewCardsError;
  const reviewCardIds=(reviewCards??[]).map(card=>card.id);if(reviewCardIds.length){const {error:logsError}=await client.from('student_flashcard_review_logs').delete().in('review_card_id',reviewCardIds);if(logsError)throw logsError;}
  const {error}=await client.from('flashcards').delete().eq('id',flashcardId);if(error)throw error;
}
async function signIn(page:Page){await page.goto('/login?next=/resources/flashcards');await page.getByLabel('Email').fill('alice.williams@student.test');await page.getByPlaceholder('Enter your password').fill('test-password');await page.getByRole('button',{name:'Sign In'}).click();await expect(page).toHaveURL(/\/resources\/flashcards/,{timeout:20_000});
  const continueButton=page.getByRole('button',{name:'Continue'});await continueButton.waitFor({state:'visible',timeout:3_000}).catch(()=>undefined);
  if(await continueButton.isVisible()){const welcome=page.getByRole('dialog',{name:'Welcome onboarding'});await continueButton.click();await page.getByRole('button',{name:'Finish'}).click();await expect(welcome).toBeHidden({timeout:10_000});}
  const tour=page.getByRole('dialog',{name:'Flashcard review'});await tour.waitFor({state:'visible',timeout:3_000}).catch(()=>undefined);if(await tour.isVisible())await tour.getByRole('button',{name:'Finish'}).click();
}

test.beforeAll(async()=>{await deleteFixture();const {error}=await admin().from('flashcards').insert({id:flashcardId,topic_id:'30000000-0000-0000-0000-000000000001',card_type:'text_cloze',cloze_text:'The scheduling journey answer is {{c1::FSRS}}.',index:9990});if(error)throw error;});
test.afterAll(deleteFixture);

test('student answers a scheduled card and can inspect its history',async({page})=>{await signIn(page);await page.getByRole('link',{name:/Study all/i}).click();await expect(page).toHaveURL(/study=all/);
  const journey=page.getByText(/scheduling journey answer/i);await expect(journey).toBeVisible();await page.getByRole('button',{name:/Show answer/}).click();await page.getByRole('button',{name:/Good/}).click();await expect(journey).toBeHidden();
  await page.evaluate(async(id)=>{const cards=await fetch('/api/flashcards/review-cards?mode=all').then(r=>r.json());const card=cards.data.find((item:{flashcard_id:string})=>item.flashcard_id===id);await fetch(`/api/flashcards/review-cards/${card.id}/manage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'suspend',requestId:crypto.randomUUID()})});},flashcardId);
  await page.getByRole('button',{name:'Manage'}).click();const manager=page.getByRole('dialog',{name:'Manage flashcards'});await expect(manager).toBeVisible();await expect(manager.getByRole('heading',{name:'Review history'})).toBeVisible();await expect(manager.getByText(/· good$/i)).toBeVisible();
});
