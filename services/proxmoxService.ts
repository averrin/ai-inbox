import { ProxmoxServer, ProxmoxNode, ProxmoxService } from '../store/proxmoxStore';

export async function fetchProxmoxData(server: ProxmoxServer): Promise<{ nodes: ProxmoxNode[], services: ProxmoxService[] }> {
    const headers = {
        'Authorization': `PVEAPIToken=${server.username}!${server.tokenId}=${server.secret}`,
        'Accept': 'application/json',
    };

    console.log(`[Proxmox] Fetching nodes from ${server.url}`);

    let nodesResp: Response;
    try {
        nodesResp = await fetch(`${server.url}/api2/json/nodes`, { headers });
    } catch (e: any) {
        console.error(`[Proxmox] Connection error for ${server.url}:`, e);

        // Enhance error message for common issues
        let msg = e.message || 'Unknown network error';
        if (msg === 'Network request failed') {
            msg += ' (Possible SSL/Cert mismatch or unreachable host)';
        }

        throw new Error(`Connection failed: ${msg}`);
    }

    if (!nodesResp.ok) {
        if (nodesResp.status === 401) {
            throw new Error("Authentication failed: Check Token ID and Secret");
        }
        if (nodesResp.status === 404) {
            throw new Error("API not found: Check Server URL");
        }
        const text = await nodesResp.text();
        throw new Error(`API Error ${nodesResp.status}: ${text}`);
    }

    const nodesJson = await nodesResp.json();
    const nodes: ProxmoxNode[] = nodesJson.data;

    let allServices: ProxmoxService[] = [];

    // Parallel fetch for all nodes
    await Promise.all(nodes.map(async (node) => {
        // Fetch LXC
        try {
            const lxcResp = await fetch(`${server.url}/api2/json/nodes/${node.node}/lxc`, { headers });
            if (lxcResp.ok) {
                const lxcJson = await lxcResp.json();
                const lxcData = lxcJson.data.map((item: any) => ({
                    ...item,
                    id: `lxc/${item.vmid}`,
                    type: 'lxc',
                    node: node.node,
                }));
                // Thread-safe push? JS is single threaded event loop, so yes.
                allServices.push(...lxcData);
            }
        } catch (e) {
            console.warn(`[Proxmox] Failed to fetch LXC for node ${node.node}`, e);
        }

        // Fetch QEMU
        try {
            const qemuResp = await fetch(`${server.url}/api2/json/nodes/${node.node}/qemu`, { headers });
            if (qemuResp.ok) {
                const qemuJson = await qemuResp.json();
                const qemuData = qemuJson.data.map((item: any) => ({
                    ...item,
                    id: `qemu/${item.vmid}`,
                    type: 'qemu',
                    node: node.node
                }));
                allServices.push(...qemuData);
            }
        } catch (e) {
             console.warn(`[Proxmox] Failed to fetch QEMU for node ${node.node}`, e);
        }
    }));

    // Enhance with IPs (parallel)
    await Promise.all(allServices.map(async (service) => {
        if (service.status !== 'running') return;

        try {
            if (service.type === 'lxc') {
                // Try interfaces endpoint for LXC
                const resp = await fetch(`${server.url}/api2/json/nodes/${service.node}/lxc/${service.vmid}/interfaces`, { headers });
                if (resp.ok) {
                   const json = await resp.json();
                   // json.data is array of { name: 'eth0', inet: '192.168.1.50/24', ... }
                   const iface = json.data.find((i: any) => i.name !== 'lo' && i.inet);
                   if (iface) {
                       service.ip = iface.inet.split('/')[0];
                   }
                }
            } else if (service.type === 'qemu') {
                // Try guest agent for QEMU
                const resp = await fetch(`${server.url}/api2/json/nodes/${service.node}/qemu/${service.vmid}/agent/network-get-interfaces`, { headers });
                if (resp.ok) {
                   const json = await resp.json();
                   const ifaces = json.data.result || [];
                   // Find non-loopback IP
                   const ip = ifaces.find((i: any) => i.name !== 'lo' && i['ip-addresses'])?.['ip-addresses']?.find((ip: any) => ip['ip-address-type'] === 'ipv4')?.['ip-address'];
                   if (ip) service.ip = ip;
                }
            }
        } catch (e) {
            // Ignore errors (e.g. guest agent not running)
        }
    }));

    return { nodes, services: allServices };
}
