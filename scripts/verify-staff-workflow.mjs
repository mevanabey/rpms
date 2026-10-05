/** Integration checks against a dev Supabase project and a built RPMS app.
 * Uses temporary Auth accounts and leases, never sends emails. Lease history
 * intentionally survives cleanup: the audit log is append-only. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { parse } from 'dotenv';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const require = createRequire(import.meta.url);
const { encodeReply } = require('next/dist/compiled/react-server-dom-turbopack/client.node');
const origin = process.argv[2];
if (!origin) throw new Error('Usage: node scripts/verify-staff-workflow.mjs <app-origin>');
const env = parse(readFileSync('.env.local'));
const sql = postgres(env.DATABASE_URL, { prepare: false, max: 2 });
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const manifest = JSON.parse(readFileSync('.next.nosync/server/server-reference-manifest.json'));
const ids = new Map(Object.entries(manifest.node).map(([id, entry]) => [entry.exportedName, id]));
const tag = 'qa-' + randomBytes(5).toString('hex');
const users = []; const leaseIds = []; const partyIds = []; const propertyIds = []; const storagePaths = [];
const checks = [];
function check(name, condition) { assert(condition, name); checks.push(name); console.log('PASS ' + name); }
async function account(role, roles = [role], setup = false, provision = true) {
  const email = `${tag}-${users.length}@example.invalid`;
  const password = randomBytes(24).toString('base64url')+'Aa1!';
  const { data, error } = await admin.auth.admin.createUser({ email, ...(setup ? {} : { password }), email_confirm: true, user_metadata: { full_name: `QA ${role} ${tag}` } });
  if (error) throw error;
  const user = { id: data.user.id, email, password, role, roles, jar: new Map() }; users.push(user);
  if (provision) await sql`insert into user_role (user_id,role,roles,is_active,password_setup_required) values(${user.id},${role},${sql.array(roles,1009)}::text[],true,${setup})`;
  if (!setup) {
    const client = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => [...user.jar].map(([name,value])=>({name,value})), setAll: values=>values.forEach(({name,value})=>user.jar.set(name,value)) } });
    const result = await client.auth.signInWithPassword({email,password}); if (result.error) throw result.error;
  }
  return user;
}
function cookies(user) { return [...user.jar].map(([name,value])=>`${name}=${value}`).join('; '); }
async function action(user, name, args, route = '/leases/new', render = false) {
  const id = ids.get(name); assert(id, `Missing action ${name}`);
  const body = await encodeReply(args);
  // Request action results without an extra Flight page render. Every relevant
  // page is fetched separately below, with normal browser-facing responses.
  const response = await fetch(origin + route, { method:'POST', headers:{Cookie:cookies(user),Origin:origin,'Next-Action':id,...(render ? {'Next-Router-State-Tree':encodeURIComponent(JSON.stringify(['',{children:['(app)',{children:['leases',{children:[['id',route.split('/').at(-1),'d',null],{children:['__PAGE__',{}]}]}]}]}]))} : {'x-action-forwarded':'1'}),Accept:'text/x-component',...(typeof body === 'string' ? {'Content-Type':'text/plain;charset=UTF-8'}:{})}, body, redirect:'manual',signal:AbortSignal.timeout(60000) });
  const content = await response.text();
  const resultLine = content.split('\n').find(line=>/^\d+:\{"ok":/.test(line));
  if (!resultLine) throw new Error(`${name}: HTTP ${response.status}; missing action result. ${content.slice(0,300)}`);
  return JSON.parse(resultLine.slice(resultLine.indexOf(':')+1));
}
async function good(user, name, args, route) { const result=await action(user,name,args,route); assert.equal(result.ok,true, `${name}: ${result.error}`); return result.data; }
async function page(user, route) {
  const response=await fetch(origin+route,{headers:user?{Cookie:cookies(user)}:{},redirect:'manual',signal:AbortSignal.timeout(60000)});
  const body=await response.text();return {response,body,error:/"digest":"[0-9]+"/.test(body)};
}
async function lease(user, property, lessor, lessee, additionalRoles=[]) {
  const result=await good(user,'createLeaseAction',[{propertyId:property.id,unitIds:[],lessorPartyId:lessor.id,lesseePartyId:lessee.id,kind:'head',purpose:'commercial',paymentCadence:'monthly',defaultPaymentMethod:'lkr_transfer',startDate:'2026-10-01',endDate:'2026-12-31',additionalRoles,tranches:[{sequence:1,startDate:'2026-10-01',endDate:'2026-12-31',monthlyRent:{amount:25000,currency:'LKR'},dueDayOfMonth:1}]}]);leaseIds.push(result.id);return result;
}
try {
  const publicLogin=await page(null,'/login');check('Public login starts with email only and no signup', publicLogin.response.status===200 && publicLogin.body.includes('id="auth-email"') && publicLogin.body.includes('Continue') && !publicLogin.body.includes('id="auth-password"') && !publicLogin.body.includes('Create account'));
  const anonymous=await page(null,'/leases');check('Anonymous lease access is denied',anonymous.response.status===307);
  const owner=await account('admin');const advisor=await account('advisor');const accountant=await account('accountant');const lawyer=await account('lawyer');const outsider=await account('advisor');const manager=await account('account_manager');const dual=await account('lawyer',['lawyer','advisor']);
  const publicCaller={jar:new Map()};
  const nextStep=await action(publicCaller,'beginSignInAction',['  '+owner.email.toUpperCase()+'  '],'/login');check('Existing password account advances to password and normalizes email',nextStep.ok&&nextStep.step==='password'&&nextStep.email===owner.email);
  const invalidEmail=await action(publicCaller,'beginSignInAction',['invalid-email'],'/login');check('Email step validates input',!invalidEmail.ok);
  const missingEmail=await action(publicCaller,'requestPasswordCodeAction',[tag+'-missing@example.invalid'],'/login');check('OTP requests cannot provision unapproved accounts',!missingEmail.ok);
  const otpSetup=await account('advisor',['advisor'],true);
  const otpClient=createServerClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[...otpSetup.jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>otpSetup.jar.set(name,value))}});
  const otpLink=await admin.auth.admin.generateLink({type:'recovery',email:otpSetup.email});if(otpLink.error)throw otpLink.error;
  const otp=otpLink.data.properties.email_otp;check('Supabase recovery provides a six-digit email code',/^\d{6}$/.test(otp));
  const setupStep=await action(publicCaller,'beginSignInAction',[otpSetup.email],'/login');check('First-time email advances directly to OTP',setupStep.ok&&setupStep.step==='code');
  const [beforeResend]=await sql`select recovery_sent_at from auth.users where id=${otpSetup.id}`;
  await good(publicCaller,'requestPasswordCodeAction',[otpSetup.email],'/login');
  const [afterResend]=await sql`select recovery_sent_at from auth.users where id=${otpSetup.id}`;check('Repeated code requests within a minute reuse the pending code',String(beforeResend.recovery_sent_at)===String(afterResend.recovery_sent_at));
  const wrongOtp=await otpClient.auth.verifyOtp({email:otpSetup.email,token:otp==='000000'?'111111':'000000',type:'recovery'});check('Incorrect email code is rejected',Boolean(wrongOtp.error));
  await sql`update auth.users set recovery_sent_at=now()-interval '55 minutes' where id=${otpSetup.id}`;
  const verifiedOtp=await otpClient.auth.verifyOtp({email:otpSetup.email,token:otp,type:'recovery'});check('Email code remains valid after a 55-minute delivery delay',!verifiedOtp.error);
  const inlineSetup=await page(otpSetup,'/login');check('Verified first-time account gets password setup on the login screen',inlineSetup.response.status===200&&!inlineSetup.error&&inlineSetup.body.includes('Set your first password')&&inlineSetup.body.includes('id="new-password"'));
  const otpPassword=randomBytes(24).toString('base64url')+'Aa1!';await good(otpSetup,'setPasswordAction',[otpPassword,otpPassword],'/login');
  const [otpFlag]=await sql`select password_setup_required from user_role where user_id=${otpSetup.id}`;check('OTP password setup clears first-login requirement',otpFlag.password_setup_required===false);
  const replayOtp=await otpClient.auth.verifyOtp({email:otpSetup.email,token:otp,type:'recovery'});check('Email code is single-use',Boolean(replayOtp.error));
  const expiredSetup=await account('advisor',['advisor'],true);
  const expiredLink=await admin.auth.admin.generateLink({type:'recovery',email:expiredSetup.email});if(expiredLink.error)throw expiredLink.error;
  await sql`update auth.users set recovery_sent_at=now()-interval '61 minutes' where id=${expiredSetup.id}`;
  const expiredClient=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const expired=await expiredClient.auth.verifyOtp({email:expiredSetup.email,token:expiredLink.data.properties.email_otp,type:'recovery'});check('Email code expires after the configured one hour',Boolean(expired.error));
  const inactive=await account('advisor');await sql`update user_role set is_active=false where user_id=${inactive.id}`;
  const inactiveStep=await action(publicCaller,'beginSignInAction',[inactive.email],'/login');check('Inactive account is denied at email step',!inactiveStep.ok);
  for (const user of [advisor,accountant,lawyer,dual]) {
    const [contact]=await sql`insert into party(kind,display_name,emails)values('individual',${`QA staff ${tag} ${user.role}`},${sql.array([user.email],1009)}::text[])returning id`;
    partyIds.push(contact.id);await sql`update user_role set party_id=${contact.id} where user_id=${user.id}`;user.partyId=contact.id;
  }
  const setup=await account('advisor',['advisor'],true);
  const link=await admin.auth.admin.generateLink({type:'recovery',email:setup.email});if(link.error)throw link.error;
  // Generate a token without sending mail; exercise the actual callback route.
  const confirm=await fetch(origin+'/auth/confirm?'+new URLSearchParams({token_hash:link.data.properties.hashed_token,type:'recovery',next:'https://example.com'}),{redirect:'manual',signal:AbortSignal.timeout(30000)});
  for(const cookie of confirm.headers.getSetCookie()) {const [pair]=cookie.split(';');const eq=pair.indexOf('=');setup.jar.set(pair.slice(0,eq),pair.slice(eq+1));}
  check('Recovery callback verifies token and ignores external redirects',confirm.status===307 && new URL(confirm.headers.get('location')).pathname==='/auth/update-password' && setup.jar.size>0);
  const preSetup=await page(setup,'/leases');check('First-time account cannot access leases before choosing a password',preSetup.response.status!==200 || preSetup.error);
  const form=await page(setup,'/auth/update-password');check('First-time password form is available',form.response.status===200 && form.body.includes('Set your first password'));
  const newPassword=randomBytes(24).toString('base64url')+'Aa1!';const bad=await action(setup,'setPasswordAction',[newPassword,'mismatch'],'/auth/update-password');check('Mismatched passwords are rejected',!bad.ok);
  await good(setup,'setPasswordAction',[newPassword,newPassword],'/auth/update-password');const [status]=await sql`select password_setup_required from user_role where user_id=${setup.id}`;check('Password setup clears the server gate',!status.password_setup_required);
  const client=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});check('New password signs in successfully',!(await client.auth.signInWithPassword({email:setup.email,password:newPassword})).error);
  const replay=await fetch(origin+'/auth/confirm?'+new URLSearchParams({token_hash:link.data.properties.hashed_token,type:'recovery'}),{redirect:'manual'});check('Password token is single-use',new URL(replay.headers.get('location')).pathname==='/login');
  const unknown=await account('viewer',['viewer'],false,false);const unknownPage=await page(unknown,'/leases');const [unknownCount]=await sql`select count(*)::int as count from user_role where user_id=${unknown.id}`;check('Unprovisioned accounts get no app access or auto-created role',unknownPage.error||unknownPage.response.status!==200);check('Unknown account remains unprovisioned',unknownCount.count===0);
  const property=await good(advisor,'createPropertyAction',[{name:`QA property ${tag}`,addressLine:'QA temporary address',city:'Colombo'}]);propertyIds.push(property.id);
  const lessor=await good(advisor,'createPartyAction',[{kind:'individual',displayName:`QA landlord ${tag}`}]);partyIds.push(lessor.id);
  const tenants=[];for(const label of ['A','B','C','D']){const tenant=await good(owner,'createPartyAction',[{kind:'individual',displayName:`QA PRIVATE ${label} ${tag}`}]);partyIds.push(tenant.id);tenants.push(tenant);}
  const a=await lease(advisor,property,lessor,tenants[0],[{role:'lessor_lawyer',partyId:lawyer.partyId,userId:lawyer.id}]);const b=await lease(accountant,property,lessor,tenants[1],[{role:'advisor',partyId:dual.partyId,userId:dual.id}]);const c=await lease(owner,property,lessor,tenants[2]);const d=await lease(manager,property,lessor,tenants[3]);
  const authors=await sql`select id,created_by from lease where id in ${sql(leaseIds)}`;check('Lease creator is recorded from the authenticated session',authors.find(x=>x.id===a.id).created_by===advisor.id && authors.find(x=>x.id===b.id).created_by===accountant.id);
  for (const [user,allowed,denied] of [[advisor,[a],[b,c,d]],[accountant,[b],[a,c,d]],[lawyer,[a],[b,c,d]],[dual,[b],[a,c,d]],[manager,[d],[a,b,c]],[outsider,[],[a,b,c,d]],[owner,[a,b,c,d],[]]]) {
    const view=await page(user,'/leases');check(`${user.role} lease list is scoped (${user.id.slice(0,5)})`,view.response.status===200&&!view.error&&allowed.every(l=>view.body.includes(l.id))&&denied.every(l=>!view.body.includes(l.id)));
  }
  check('Advisor can open a lease they created without self-assignment',(await page(advisor,'/leases/'+a.id)).response.status===200);
  check('Lawyer can view their explicit assignment',!(await page(lawyer,'/leases/'+a.id)).error);
  check('Dual-role user can see advisor assignment with lawyer primary role',!(await page(dual,'/leases/'+b.id)).error);
  const wrongRead=await action(outsider,'getLeaseAgreementUrlAction',[a.id],'/leases/'+a.id);check('Unassigned document download is denied',!wrongRead.ok);
  const wrongEdit=await action(outsider,'updateLeaseAction',[a.id,{occupancyCap:999}],'/leases/'+a.id);check('Unassigned lease editing is denied',!wrongEdit.ok);
  const lawyerEdit=await action(lawyer,'updateLeaseAction',[a.id,{occupancyCap:999}],'/leases/'+a.id);check('Read-only lawyer cannot edit leases',!lawyerEdit.ok);
  const early=await action(advisor,'markLeaseEmailManuallySentAction',[a.id,{kind:'accounts',recipients:['test@example.invalid'],note:'QA early confirmation'}],'/leases/'+a.id);check('Manual email cannot skip prerequisites',!early.ok);
  await Promise.all([good(advisor,'updateLeaseAction',[a.id,{occupancyCap:3}],'/leases/'+a.id),good(accountant,'updateLeaseAction',[b.id,{occupancyCap:4}],'/leases/'+b.id)]);
  const concurrentActors=await sql`select lease_id,actor_id from lease_audit where action='Lease edited' and ((lease_id=${a.id} and ("after"->>'occupancy_cap')='3') or (lease_id=${b.id} and ("after"->>'occupancy_cap')='4'))`;check('Concurrent mutations keep actors isolated',concurrentActors.every(row=>row.actor_id===(row.lease_id===a.id?advisor.id:accountant.id))&&concurrentActors.length===2);
  const fd=new FormData();fd.set('file',new File(['%PDF-1.4\nQA upload\n%%EOF'], 'qa-agreement.pdf',{type:'application/pdf'}));const uploaded=await good(advisor,'uploadLeaseAgreementAction',[a.id,fd],'/leases/'+a.id);storagePaths.push(uploaded.agreementPath);check('Agreement upload advances to email stage',uploaded.onboardingStage==='agreement_ready');
  await Promise.all(['lawyer','advisor'].map(kind=>good(advisor,'markLeaseEmailManuallySentAction',[a.id,{kind,recipients:[`qa-${kind}@example.invalid`],note:'QA: email sent externally for workflow verification'}],'/leases/'+a.id)));
  const [emailed]=await sql`select onboarding_stage,lawyer_email_sent_at,advisor_email_sent_at from lease where id=${a.id}`;check('Concurrent manual confirmations preserve both sends and advance',emailed.onboarding_stage==='emails_sent' && emailed.lawyer_email_sent_at && emailed.advisor_email_sent_at);
  const accounts=await good(advisor,'markLeaseEmailManuallySentAction',[a.id,{kind:'accounts',recipients:['qa-accounts@example.invalid'],note:'QA: advisor approval and external accounts email'}],'/leases/'+a.id);check('Manual accounts confirmation moves lease to Accounts',accounts.onboardingStage==='at_accounts');
  await good(advisor,'markLeaseActiveAction',[a.id],'/leases/'+a.id);
  await good(accountant,'updateLeaseAction',[b.id,{additionalRoles:[{role:'advisor',partyId:dual.partyId,userId:dual.id},{role:'accountant_handler',partyId:accountant.partyId,userId:accountant.id}]}],'/leases/'+b.id);
  await good(owner,'updateLeaseAction',[a.id,{additionalRoles:[{role:'lessor_lawyer',partyId:lawyer.partyId,userId:lawyer.id},{role:'accountant_handler',partyId:accountant.partyId,userId:accountant.id}]}],'/leases/'+a.id);
  const paid=await good(accountant,'markNextRentPaidAction',[a.id,{paidDate:'2026-10-04',paymentMethod:'lkr_transfer',reference:'QA audit reference'}],'/leases/'+a.id);
  const duplicate=await action(accountant,'markRentPaidAction',[paid.id,{paidDate:'2026-10-04',paymentMethod:'lkr_transfer'}],'/rent');check('Duplicate payment marking is rejected',!duplicate.ok);
  await good(accountant,'unmarkRentPaidAction',[paid.id],'/rent');
  const advisorPaid=await action(advisor,'markNextRentPaidAction',[a.id,{paidDate:'2026-10-04',paymentMethod:'lkr_transfer'}],'/leases/'+a.id);check('Advisor cannot mark rent paid',!advisorPaid.ok);
  const audit=await sql`select * from lease_audit where lease_id=${a.id} order by created_at`;
  check('Creation, edit, upload, progression, and payment actors are recorded',audit.some(x=>x.action==='Lease created'&&x.actor_id===advisor.id)&&audit.some(x=>x.action==='Lease edited'&&x.actor_id===advisor.id)&&audit.some(x=>x.action==='Lease agreement uploaded'&&x.actor_id===advisor.id)&&audit.some(x=>x.action==='Email marked sent manually'&&x.details.method==='manual'&&x.details.recipients.length)&&audit.some(x=>x.action==='Rent marked paid'&&x.actor_id===accountant.id)&&audit.some(x=>x.action==='Rent payment reversed'&&x.actor_id===accountant.id));
  check('Audit retains before/after field values',audit.some(x=>x.action==='Lease edited'&&x.before?.occupancy_cap===null&&x.after?.occupancy_cap===3));
  let immutable=false;try{await sql`delete from lease_audit where id=${audit[0].id}`;}catch(e){immutable=e.message.includes('append-only');}check('Audit entries cannot be deleted',immutable);
  const outsiderAudit=await page(outsider,'/activity');check('Unassigned user cannot see audit entries',!outsiderAudit.body.includes(a.id)&&!outsiderAudit.body.includes('QA audit reference'));
  const deniedAudit=await page(outsider,'/activity/'+audit[0].id);check('Direct out-of-scope audit event is hidden',deniedAudit.response.status===404);
  const visibleAudit=await page(lawyer,'/activity/'+audit[0].id);check('Assigned lawyer can inspect lease history',visibleAudit.response.status===200&&!visibleAudit.error);
  let authorImmutable=false;try{await sql`update lease set created_by=${owner.id} where id=${a.id}`;}catch(error){authorImmutable=error.message.includes('authorship');}check('Lease authorship cannot be reassigned',authorImmutable);
  let updateImmutable=false;try{await sql`update lease_audit set actor_name='Changed' where id=${audit[0].id}`;}catch(error){updateImmutable=error.message.includes('append-only');}check('Audit entries cannot be edited',updateImmutable);
  await good(owner,'updateLeaseAction',[a.id,{additionalRoles:[{role:'accountant_handler',partyId:accountant.partyId,userId:accountant.id}]}],'/leases/'+a.id);
  const revoked=await action(lawyer,'getLeaseAgreementUrlAction',[a.id],'/leases/'+a.id);check('Removing an assignment revokes lease downloads',!revoked.ok);
  const revokedList=await page(lawyer,'/leases');check('Removing an assignment revokes list visibility',!revokedList.body.includes(a.id));
  const creatorList=await page(advisor,'/leases');check('Creator access survives team reassignment',creatorList.body.includes(a.id));
  const renderedAction=await action(advisor,'updateLeaseAction',[a.id,{occupancyCap:5}],'/leases/'+a.id,true);check('Browser-style action completes with refreshed page payload',renderedAction.ok);
  const signup=await fetch(env.NEXT_PUBLIC_SUPABASE_URL+'/auth/v1/signup',{method:'POST',headers:{apikey:env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:tag+'-signup@example.invalid',password:randomBytes(24).toString('base64url')+'Aa1!'})});const signupResult=await signup.json();if(signupResult.id)users.push({id:signupResult.id});check('Public signup stays disabled',signup.status>=400&&signup.status<500&&signupResult.error_code==='signup_disabled');
  const clientApi=await fetch(env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/lease_audit?select=id',{headers:{apikey:env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}});check('Audit Data API is blocked for browser roles',clientApi.status===401||clientApi.status===403);
  writeFileSync('.vercel/supabase-migration/staff-integration-results.json',JSON.stringify({origin,completedAt:new Date().toISOString(),passed:true,checks},null,2),{mode:0o600});
  console.log(`All ${checks.length} integration checks passed.`);
} catch(error){console.error(error.message);process.exitCode=1;}
finally {
  if(storagePaths.length){const {error}=await admin.storage.from('lease-documents').remove(storagePaths);if(error){console.error('Storage cleanup: '+error.message);process.exitCode=1;}}
  if(leaseIds.length) await sql`delete from lease where id in ${sql(leaseIds)}`;
  for(const user of users){const {error}=await admin.auth.admin.deleteUser(user.id);if(error){console.error('User cleanup failed: '+error.message);process.exitCode=1;}}
  if(partyIds.length)await sql`delete from party where id in ${sql(partyIds)}`;
  if(propertyIds.length)await sql`delete from property where id in ${sql(propertyIds)}`;
  await sql.end({timeout:3});
  console.log('Temporary accounts and business records removed; audit history retained.');
}
