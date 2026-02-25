import { ProxmoxServer, ProxmoxNode, ProxmoxService } from '../store/proxmoxStore';

export async function fetchProxmoxData(server: ProxmoxServer): Promise<{ nodes: ProxmoxNode[], services: ProxmoxService[] }> {
    const headers = {
        'Authorization': `PVEAPIToken=${server.username}!${server.tokenId}=${server.secret}`,
        'Accept': 'application/json',
    };

    console.log(`[Proxmox] Fetching nodes from ${server.url}`);
    const nodesResp = await fetch(`${server.url}/api2/json/nodes`, { headers });

    if (!nodesResp.ok) {
        const text = await nodesResp.text();
        throw new Error(`Failed to fetch nodes: ${nodesResp.status} ${text}`);
    }

    const nodesJson = await nodesResp.json();
    const nodes: ProxmoxNode[] = nodesJson.data;

    let allServices: ProxmoxService[] = [];

    for (const node of nodes) {
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
                allServices = [...allServices, ...lxcData];
            }
        } catch (e) {
            console.error(`Failed to fetch LXC for node ${node.node}`, e);
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
                allServices = [...allServices, ...qemuData];
            }
        } catch (e) {
            console.error(`Failed to fetch QEMU for node ${node.node}`, e);
        }
    }

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
