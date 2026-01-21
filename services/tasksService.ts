interface CreateTaskParams {
    title: string;
    notes?: string;
    due?: string; // RFC 3339 timestamp
}

export class TasksService {
    private static BASE_URL = 'https://tasks.googleapis.com/tasks/v1';

    static async createTask(accessToken: string, task: CreateTaskParams): Promise<any> {
        try {
            const response = await fetch(`${this.BASE_URL}/lists/@default/tasks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: task.title,
                    notes: task.due && task.due.includes('T')
                        ? `${task.notes || ''}\nScheduled: ${new Date(task.due).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`.trim()
                        : task.notes,
                    due: task.due ? new Date(task.due).toISOString() : undefined,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Google Tasks API Error: ${response.status} - ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating Google Task:', error);
            throw error;
        }
    }

    // Optional: List task lists or tasks if validation is needed later
}
