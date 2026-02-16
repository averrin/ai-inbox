import {
    WorkflowRun,
    CheckRun,
    Artifact,
    PullRequest,
    SessionOutput,
    SourceContext,
    JulesSession,
    fetchWorkflowRuns,
    fetchChecks,
    fetchArtifacts,
    mergePullRequest,
    fetchPullRequest,
    deleteJulesSession,
    fetchJulesSessions,
    sendMessageToSession,
    fetchGithubRepoDetails
} from './julesApi';
const GITHUB_API_BASE = 'https://api.github.com';

const getHeaders = (token: string) => ({
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28'
});

export interface GithubUser {
    login: string;
    id: number;
    avatar_url: string;
    name: string;
}

export interface GithubRepo {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    description: string;
    owner: GithubUser;
    default_branch: string;
}

export async function fetchGithubUser(token: string): Promise<GithubUser> {
    const response = await fetch(`${GITHUB_API_BASE}/user`, {
        headers: getHeaders(token)
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch user: ${response.status} ${text}`);
    }
    return await response.json();
}

export async function fetchGithubRepos(token: string, page: number = 1): Promise<GithubRepo[]> {
    const response = await fetch(`${GITHUB_API_BASE}/user/repos?sort=updated&per_page=100&page=${page}`, {
        headers: getHeaders(token)
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch repos: ${response.status} ${text}`);
    }
    return await response.json();
}

export async function exchangeGithubToken(clientId: string, clientSecret: string, code: string, redirectUri: string, codeVerifier?: string): Promise<string> {
    console.log(redirectUri)
    const url = 'https://github.com/login/oauth/access_token';
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code: code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to exchange token: ${response.status} ${text}`);
    }

    const data = await response.json();
    if (data.error) {
        throw new Error(`GitHub OAuth Error: ${data.error_description || data.error}`);
    }
    return data.access_token;
}

// Re-export types and functions
export {
    WorkflowRun,
    CheckRun,
    Artifact,
    PullRequest,
    SessionOutput,
    SourceContext,
    JulesSession,
    fetchWorkflowRuns,
    fetchChecks,
    fetchArtifacts,
    mergePullRequest,
    fetchPullRequest,
    deleteJulesSession,
    fetchJulesSessions,
    sendMessageToSession,
    fetchGithubRepoDetails
};
