import cookie from '@elysiajs/cookie';
import Elysia from 'elysia';
import * as oauth from 'oauth4webapi';
import * as jose from 'jose';

type OIDCSettings = { issuerUrl: string, redirect_uri: string, client_id: string, client_secret: string };

export async function genOIDCState({ issuerUrl, redirect_uri, client_id, client_secret }: OIDCSettings) {
    const issuer = new URL(issuerUrl);
    const as = await oauth
      .discoveryRequest(issuer, { algorithm: 'oidc' })
      .then((response) => oauth.processDiscoveryResponse(issuer, response));
    
    console.log(as);
    const JWKS = await jose.createRemoteJWKSet(new URL(as.jwks_uri!));
    const client: oauth.Client = {
        client_id,
        client_secret,
        token_endpoint_auth_method: 'client_secret_post',
      }

    if (as.code_challenge_methods_supported?.includes('S256') !== true) {
        throw new Error("S256 PKCE not supported by oidc provdier")
    }
    
    const code_verifier = oauth.generateRandomCodeVerifier();
    const code_challenge = await oauth.calculatePKCECodeChallenge(code_verifier);
    const code_challenge_method = 'S256';
    const res = {
        issuer,
        as,
        redirect_uri,
        client,
        code_verifier,
        code_challenge,
        code_challenge_method,
        JWKS,
    }
    return res;
}


export const plugin = async (params: OIDCSettings) => {
    const oidc = await genOIDCState(params);
    const decodeUser = async (jwt: string) => {
        let res;
        try { 
            res = await jose.jwtVerify(jwt, oidc.JWKS, {
                issuer: oidc.as.issuer,
                //audience: oidc.client.client_id,
            });
        } catch (e) {};
        return res?.payload;
    }
    return (app: Elysia) => app
        .use(cookie())
        .state('oidc', oidc)
        .decorate('decode_user', decodeUser)
        .get('/login', ({ set, store: { oidc } }) => {
            const { as, client, code_challenge, code_challenge_method, redirect_uri } = oidc;
            const authorizationUrl = new URL(as.authorization_endpoint!)
            authorizationUrl.searchParams.set('client_id', client.client_id)
            authorizationUrl.searchParams.set('code_challenge', code_challenge)
            authorizationUrl.searchParams.set('code_challenge_method', code_challenge_method)
            authorizationUrl.searchParams.set('redirect_uri', redirect_uri)
            authorizationUrl.searchParams.set('response_type', 'code')
            authorizationUrl.searchParams.set('scope', 'profile')
            set.redirect = authorizationUrl.href;
        })
        .get("login_verify", async ({ setCookie, set, query, store: { oidc} }) => {
            const { as, client, redirect_uri, code_verifier } = oidc;
            const searchParams = new URLSearchParams();
            searchParams.set('code', query.code as string);
            searchParams.set('session_state', query.session_state as string);
            const parameters = oauth.validateAuthResponse(as, client, searchParams, oauth.expectNoState);
            if (oauth.isOAuth2Error(parameters)) {
                console.log('error', parameters)
                throw new Error('oauth error') // Handle OAuth 2.0 redirect error
            }
            const response = await oauth.authorizationCodeGrantRequest(
                as,
                client,
                parameters,
                redirect_uri,
                code_verifier,
            );
            let challenges: oauth.WWWAuthenticateChallenge[] | undefined;
            if ((challenges = oauth.parseWwwAuthenticateChallenges(response))) {
                for (const challenge of challenges) {
                    console.log('challenge', challenge)
                }
                throw new Error('www auth challange fail') // Handle www-authenticate challenges as needed
            }

            const result = await oauth.processAuthorizationCodeOAuth2Response(as, client, response)
            if (oauth.isOAuth2Error(result)) {
                console.log('error', result)
                throw new Error('oauth2 error') // Handle OAuth 2.0 response body error
            }

            if (result.access_token) { setCookie('access_token', result.access_token); }
            if (result.refresh_token) { setCookie('refresh_token', result.refresh_token); }
            const { payload, protectedHeader } = await jose.jwtVerify(result.access_token, oidc.JWKS, {
                issuer: oidc.as.issuer,
                //audience: oidc.client.client_id,
              })
            console.log(protectedHeader)
            console.log(payload)
            set.redirect = '/';
        });
}
    