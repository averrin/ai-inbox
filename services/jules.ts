
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

export async function fetchWorkflowRuns(token: string, owner: string, repo: string, workflowId?: string, limit: number = 10): Promise<WorkflowRun[]> {
    let url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs?per_page=${limit}`;
    // If workflowId is provided (filename or ID), we can filter by it.
    // However, the API endpoint for a specific workflow is /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs
    // If workflowId is just a filename (e.g. jules.yml), we can try to use it.
    if (workflowId) {
         url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?per_page=${limit}`;
    }

    const response = await fetch(url, { headers: getHeaders(token) });
    if (!response.ok) {
        // Fallback: If workflow specific fetch failed (maybe ID invalid), try fetching all runs
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
        // If checks fail, return empty list instead of throwing
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
