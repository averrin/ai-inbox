const GITHUB_API_BASE = 'https://api.github.com';

const getHeaders = (token: string) => ({
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28'
});

export interface WorkflowRun {
    id: number;
    name: string;
    head_branch: string;
    head_sha: string;
    status: string; // queued, in_progress, completed
    conclusion: string | null; // success, failure, cancelled, skipped, timed_out, action_required
    created_at: string;
    updated_at: string;
    html_url: string;
    pull_requests: {
        id: number;
        number: number;
        url: string;
        head: { ref: string, sha: string, repo: { id: number, url: string, name: string } };
        base: { ref: string, sha: string, repo: { id: number, url: string, name: string } };
    }[];
}

export interface CheckRun {
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    html_url: string;
    started_at: string;
    completed_at: string | null;
}

export interface Artifact {
    id: number;
    name: string;
    size_in_bytes: number;
    url: string;
    archive_download_url: string;
    created_at: string;
    expired: boolean;
}

export async function fetchWorkflowRuns(token: string, owner: string, repo: string, workflowId?: string, limit: number = 25, branch?: string): Promise<WorkflowRun[]> {
    let url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs?per_page=${limit}`;
    if (branch) url += `&branch=${branch}`;
    if (workflowId) {
        url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?per_page=${limit}`;
        if (branch) url += `&branch=${branch}`;
    }

    const response = await fetch(url, { headers: getHeaders(token) });
    if (!response.ok) {
        if (workflowId) {
            const fallbackUrl = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs?per_page=${limit}`;
            const fallbackResponse = await fetch(fallbackUrl, { headers: getHeaders(token) });
            if (fallbackResponse.ok) {
                const data = await fallbackResponse.json();
                return data.workflow_runs;
            }
        }
        const text = await response.text();
        throw new Error(`Failed to fetch workflow runs: ${response.status} ${text}`);
    }
    const data = await response.json();
    return data.workflow_runs;
}

export async function fetchChecks(token: string, owner: string, repo: string, ref: string): Promise<CheckRun[]> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${ref}/check-runs`;
    const response = await fetch(url, { headers: getHeaders(token) });
    if (!response.ok) {
        console.warn(`Failed to fetch checks for ref ${ref}: ${response.status}`);
        return [];
    }
    const data = await response.json();
    return data.check_runs;
}

export async function fetchArtifacts(token: string, owner: string, repo: string, runId: number): Promise<Artifact[]> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`;
    const response = await fetch(url, { headers: getHeaders(token) });
    if (!response.ok) {
        console.warn(`Failed to fetch artifacts for run ${runId}: ${response.status}`);
        return [];
    }
    const data = await response.json();
    return data.artifacts;
}

export async function mergePullRequest(token: string, owner: string, repo: string, pullNumber: number): Promise<boolean> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pullNumber}/merge`;
    const response = await fetch(url, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify({
            merge_method: 'squash'
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to merge PR: ${response.status} ${text}`);
    }

    return true;
}

export async function fetchPullRequest(token: string, owner: string, repo: string, pullNumber: number): Promise<any> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pullNumber}`;
    const response = await fetch(url, { headers: getHeaders(token) });
    if (!response.ok) {
        const text = await response.text();
        console.error(`Failed to fetch PR: ${owner}/${repo} #${pullNumber}`, response.status, text);
        throw new Error(`Failed to fetch PR: ${response.status} ${text}`);
    }
    return await response.json();
}
export interface PullRequest {
    url: string;
    title?: string;
    description?: string;
    number?: number;
    merged?: boolean;
    state?: string;
    mergeable?: boolean | null;
    mergeable_state?: string;
}

export interface SessionOutput {
    pullRequest?: PullRequest;
    changeSet?: any;
}

export interface SourceContext {
    source: string;
    githubRepoContext?: {
        startingBranch?: string;
    };
}

export interface JulesSession {
    name: string;
    id: string; // Leaf ID
    title: string;
    state: string; // QUEUED, PLANNING, AWAITING_PLAN_APPROVAL, AWAITING_USER_FEEDBACK, IN_PROGRESS, PAUSED, COMPLETED, FAILED
    url: string;
    createTime: string;
    updateTime: string;
    labels?: Record<string, string>;
    outputs?: SessionOutput[];
    sourceContext?: SourceContext;
    githubMetadata?: {
        pullRequestNumber?: number;
        branch?: string;
        owner?: string;
        repo?: string;
        repoFullName?: string;
    };
}

export async function deleteJulesSession(apiKey: string, sessionName: string): Promise<boolean> {
    const url = `https://jules.googleapis.com/v1alpha/${sessionName}`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            'x-goog-api-key': apiKey,
        }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to delete Jules session: ${response.status} ${text}`);
    }

    return true;
}

export async function fetchJulesSessions(apiKey: string, limit: number = 25): Promise<JulesSession[]> {
    const url = `https://jules.googleapis.com/v1alpha/sessions?pageSize=${limit}`;
    const response = await fetch(url, {
        headers: {
            'x-goog-api-key': apiKey,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch Jules sessions: ${response.status} ${text}`);
    }

    const data = await response.json();
    const sessions = (data.sessions || []).map((s: any) => {
        const parts = s.name.split('/');
        const id = parts[parts.length - 1];

        const session = s as JulesSession;
        let githubMetadata = session.githubMetadata;

        if (!githubMetadata) {
            const prOutput = session.outputs?.find(o => o.pullRequest);
            const pr = prOutput?.pullRequest;
            const branch = session.sourceContext?.githubRepoContext?.startingBranch;
            const sourceParts = session.sourceContext?.source?.split('/') || [];
            let owner = sourceParts.length >= 4 ? sourceParts[sourceParts.length - 2] : undefined;
            let repo = sourceParts.length >= 4 ? sourceParts[sourceParts.length - 1] : undefined;
            const repoFullName = owner && repo ? `${owner}/${repo}` : undefined;

            if (pr?.url) {
                const urlParts = pr.url.split('/');
                if (urlParts.length >= 7 && (urlParts[2] === 'github.com' || urlParts[2] === 'api.github.com') && (urlParts[5] === 'pull' || urlParts[6] === 'pulls')) {
                    const ownerIdx = urlParts[2] === 'api.github.com' ? 4 : 3;
                    const repoIdx = urlParts[2] === 'api.github.com' ? 5 : 4;
                    const numIdx = urlParts[2] === 'api.github.com' ? 7 : 6;

                    githubMetadata = {
                        owner: urlParts[ownerIdx],
                        repo: urlParts[repoIdx],
                        pullRequestNumber: parseInt(urlParts[numIdx], 10),
                        branch: branch || undefined,
                        repoFullName: `${urlParts[ownerIdx]}/${urlParts[repoIdx]}`,
                    };
                }
            } else if (branch || repoFullName) {
                // If we have a source URL like "https://github.com/owner/repo" or "owner/repo"
                let finalOwner = owner;
                let finalRepo = repo;

                if (session.sourceContext?.source?.startsWith('http')) {
                    const srcParts = session.sourceContext.source.split('/');
                    if (srcParts.length >= 5) {
                        finalOwner = srcParts[3];
                        finalRepo = srcParts[4];
                    }
                }

                githubMetadata = {
                    owner: finalOwner,
                    repo: finalRepo,
                    branch,
                    repoFullName: finalOwner && finalRepo ? `${finalOwner}/${finalRepo}` : repoFullName,
                };
            }
        }

        return {
            ...session,
            id,
            githubMetadata
        };
    });
    return sessions;
}

export async function sendMessageToSession(apiKey: string, sessionName: string, message: string): Promise<any> {
    const url = `https://jules.googleapis.com/v1alpha/${sessionName}:sendMessage`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'x-goog-api-key': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            userInput: { text: message }
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to send message: ${response.status} ${text}`);
    }

    return await response.json();
}
