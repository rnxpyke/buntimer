import { Elysia, t } from 'elysia';
import { Skaffold, MainPage, TimeTrackerBar, TimeEntry, Entry } from './views';
import { randomUUID, verify } from 'crypto';
import { DB } from './db';
import * as auth from './auth';
import cookie from '@elysiajs/cookie';
import assert from 'assert';
import * as oauth from 'oauth4webapi';

const CONFIG = {
    PORT: process.env.PORT ? +process.env.PORT : undefined,
    DB: process.env.SQLITE_DB ?? ':memory:',
    BASE_PATH: process.env.BASE_PATH,
    PUBLIC_DIR: process.env.PUBLIC_DIr ?? 'public',
};

assert(CONFIG.BASE_PATH, 'no base url configured');

const OIDC = {
    issuerUrl: process.env.OIDC_ISSUER_URL,
    client_id: process.env.OIDC_CLIENT_ID,
    client_secret: process.env.OIDC_CLIENT_SECRET,
    redirect_uri: new URL('/login_verify', CONFIG.BASE_PATH).href,
};

assert(OIDC.issuerUrl, 'no OIDC issuer url configured');
assert(OIDC.client_id, 'no OIDC client id configured');
assert(OIDC.client_secret, 'no OIDC client secret configured');
assert(OIDC.redirect_uri, 'no redirect uri configured');

const db = new DB(CONFIG.DB).setup();


const eventModel = t.Object({
    id: t.String(),
    description: t.String(),
    startDate: t.String(),
    stopDate: t.String(),
    start: t.String(),
    stop: t.String(),
});

const app = new Elysia()
    .use(cookie())
    .use(await auth.plugin(OIDC as any))
    .state('db', db)
    .derive(async ({ cookie: { access_token }, decode_user }) => ({ user: await decode_user(access_token) }))
    .model({ event: eventModel })
    .get('/', async ({ set, user }) => {
        if (!user) {
            set.redirect = '/login';
            return;
        }
        set.redirect = '/board';
    })
    .get('/styles.css', async () => new Response(await Bun.file(`${CONFIG.PUBLIC_DIR}/styles.css`).text(), { headers: { 'Content-Type': 'text/css' }}))
    .get('/scripts.js', async () => new Response(await Bun.file(`${CONFIG.PUBLIC_DIR}/scripts.js`).text(), { headers: { 'Content-Type': 'text/javascript' }} ))
    .guard({
        beforeHandle: async (ctx) => {
            const { store: { oidc }, decode_user, setCookie, cookie: { access_token, refresh_token } } = ctx;
            if (!await decode_user(access_token)) {
                const res = await oauth.refreshTokenGrantRequest(oidc.as, oidc.client, refresh_token, {});
                const processed = await oauth.processRefreshTokenResponse(oidc.as, oidc.client, res);
                setCookie('access_token', processed.acces_token as string);
                setCookie('refresh_token', processed.refresh_token as string);
                ctx.user = await decode_user(processed.access_token as string);
            }
            assert(ctx.user, 'not logged in');
            assert(ctx.user.sub, 'no user/subject');
        }
    }, app => app
        .get('/board', ({ user, set, store: { db } }) => {
            assert(user?.sub, 'no subject');
            const entries = db.queryEntries(user.sub);
            set.headers['Content-Type'] = 'text/html';
            return <Skaffold><MainPage events={entries} /></Skaffold>;
        })
        .post('/tracker-start', ({ set, body }) => {
            console.log('tracker-start', body);
            set.headers['Content-Type'] = 'text/html';
            return <TimeTrackerBar 
                running
                description={body?.description}
                startedAt={new Date().toISOString()}
            />;
        }, { body: t.Object({ description: t.String() })})
        .post('/tracker-stop', ({ set, user, body, store: { db } }) => {
            assert(user?.sub, 'no subject');
            console.log('tracker-stop', body);
            set.headers['Content-Type'] = 'text/html';
            const entry = {
                id: randomUUID(),
                description: body.description,
                start: new Date(body.startedAt),
                stop: new Date(),
            };
            db.insertEntry(user.sub, entry);
            return <TimeTrackerBar /> + <div>
                <TimeEntry {...entry} />
            </div>;    
        }, {
            body: t.Object({ description: t.String(), startedAt: t.String() }),
        })
        .post('entry', ({ set, user, body, store: { db }}) => {
            assert(user?.sub, 'no subject');
            console.log('entry', body);
            set.headers['Content-Type'] = 'text/html';
            const entry = db.findEntry(user.sub, body.id);
            if (!entry) {
                throw new Error('no matching entry found');
            }
            const start = new Date(body.startDate);
            const stop = new Date(body.stopDate);
            db.query("UPDATE events SET description = $description, start = $start, stop = $stop WHERE id = $id").get({
                $id: body.id,
                $start: start.toISOString(),
                $stop: stop.toISOString(),
                $description: body.description,
            });
            const newEntry = db.findEntry(user.sub, body.id)!;
            return <TimeEntry {...newEntry} />;
        }, { body: 'event' })
        .delete('entry', ({ body, store: { db }}) => {
            db.run("DELETE FROM events WHERE id = ?", [body.id]);
        }, { body: 'event' })
    )
	.listen(CONFIG.PORT ?? 3000)
	 
console.log(`🦊 Buntimer is running at ${app.server?.hostname}:${app.server?.port}`)
