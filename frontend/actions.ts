'use server';

export const checkPassword = async (password: string): Promise<boolean> => {
    return password == process.env.SIMULATION_PASSWORD;
};

export async function sendWebotsCommand(url: string, body: any) {
    await fetch(`${url}/api/scenario${body.processId}`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
            'Content-Type': 'application/json',
        },
    });
}
