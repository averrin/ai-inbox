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
