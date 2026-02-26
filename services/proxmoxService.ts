import { ProxmoxServer, ProxmoxNode, ProxmoxService } from '../store/proxmoxStore';
import { NativeModules } from 'react-native';

const { ProxmoxNetwork } = NativeModules;

export async function fetchProxmoxData(server: ProxmoxServer): Promise<{ nodes: ProxmoxNode[], services: ProxmoxService[], error?: string }> {
    const headers = {
        'Authorization': `PVEAPIToken=${server.username}!${server.tokenId}=${server.secret}`,
        'Accept': 'application/json',
    };

    // Normalize URL: remove trailing slash
    const serverUrl = server.url.replace(/\/+$/, '');

    console.log(`[Proxmox] Fetching nodes from ${serverUrl}`);

    let nodesJson: any;
    try {
        // Use native module if available to bypass SSL
        if (ProxmoxNetwork && ProxmoxNetwork.fetchUnsafe) {
            const body = await ProxmoxNetwork.fetchUnsafe(`${serverUrl}/api2/json/nodes`, headers);
            nodesJson = JSON.parse(body);
        } else {
            // Fallback to standard fetch (will fail on self-signed certs)
            console.warn('[Proxmox] Native network module not found, falling back to fetch');
            const nodesResp = await fetch(`${serverUrl}/api2/json/nodes`, { headers });
            if (!nodesResp.ok) {
                if (nodesResp.status === 401) throw new Error("Authentication failed: Check Token ID and Secret");
                if (nodesResp.status === 404) throw new Error("API not found: Check Server URL");
                const text = await nodesResp.text();
                throw new Error(`API Error ${nodesResp.status}: ${text}`);
            }
            nodesJson = await nodesResp.json();
        }
    } catch (e: any) {
        console.error(`[Proxmox] Connection error for ${serverUrl}:`, e);
        let msg = e.message || 'Unknown network error';
        if (msg === 'Network request failed') {
            msg += ' (Possible SSL/Cert mismatch or unreachable host)';
        }
        throw new Error(`Connection failed: ${msg}`);
    }

    const nodes: ProxmoxNode[] = nodesJson.data;
    let allServices: ProxmoxService[] = [];
    let fetchErrors: string[] = [];

    // Parallel fetch for all nodes
    await Promise.all(nodes.map(async (node) => {
        // Fetch LXC
        try {
            const url = `${serverUrl}/api2/json/nodes/${node.node}/lxc`;
            console.log(`[Proxmox] Fetching LXC from ${url}`);

            let lxcJson: any;
            if (ProxmoxNetwork && ProxmoxNetwork.fetchUnsafe) {
                const body = await ProxmoxNetwork.fetchUnsafe(url, headers);
                lxcJson = JSON.parse(body);
            } else {
                const lxcResp = await fetch(url, { headers });
                if (!lxcResp.ok) throw new Error(`Status ${lxcResp.status}`);
                lxcJson = await lxcResp.json();
            }

            if (lxcJson && lxcJson.data) {
                const lxcData = lxcJson.data.map((item: any) => ({
                    ...item,
                    id: `lxc/${item.vmid}`,
                    type: 'lxc',
                    node: node.node,
                }));
                allServices.push(...lxcData);
            }
        } catch (e: any) {
            const msg = `LXC fetch failed for ${node.node}: ${e.message}`;
            console.warn(`[Proxmox] ${msg}`);
            fetchErrors.push(msg);
        }

        // Fetch QEMU
        try {
            const url = `${serverUrl}/api2/json/nodes/${node.node}/qemu`;
            console.log(`[Proxmox] Fetching QEMU from ${url}`);

            let qemuJson: any;
            if (ProxmoxNetwork && ProxmoxNetwork.fetchUnsafe) {
                const body = await ProxmoxNetwork.fetchUnsafe(url, headers);
                qemuJson = JSON.parse(body);
            } else {
                const qemuResp = await fetch(url, { headers });
                if (!qemuResp.ok) throw new Error(`Status ${qemuResp.status}`);
                qemuJson = await qemuResp.json();
            }

            if (qemuJson && qemuJson.data) {
                const qemuData = qemuJson.data.map((item: any) => ({
                    ...item,
                    id: `qemu/${item.vmid}`,
                    type: 'qemu',
                    node: node.node
                }));
                allServices.push(...qemuData);
            }
        } catch (e: any) {
             const msg = `QEMU fetch failed for ${node.node}: ${e.message}`;
             console.warn(`[Proxmox] ${msg}`);
             fetchErrors.push(msg);
        }
    }));

    // Enhance with IPs (parallel)
    await Promise.all(allServices.map(async (service) => {
        if (service.status !== 'running') return;

        try {
            let ifaceJson: any;
            if (service.type === 'lxc') {
                const url = `${serverUrl}/api2/json/nodes/${service.node}/lxc/${service.vmid}/interfaces`;
                if (ProxmoxNetwork && ProxmoxNetwork.fetchUnsafe) {
                    const body = await ProxmoxNetwork.fetchUnsafe(url, headers);
                    ifaceJson = JSON.parse(body);
                } else {
                    const resp = await fetch(url, { headers });
                    if (resp.ok) ifaceJson = await resp.json();
                }

                if (ifaceJson && ifaceJson.data) {
                   // Prefer eth0 or any non-loopback
                   const iface = ifaceJson.data.find((i: any) => i.name !== 'lo' && i.inet);
                   if (iface) {
                       service.ip = iface.inet.split('/')[0];
                   }
                }
            } else if (service.type === 'qemu') {
                const url = `${serverUrl}/api2/json/nodes/${service.node}/qemu/${service.vmid}/agent/network-get-interfaces`;
                if (ProxmoxNetwork && ProxmoxNetwork.fetchUnsafe) {
                    // QEMU agent might not be running, this might fail or return error
                    try {
                        const body = await ProxmoxNetwork.fetchUnsafe(url, headers);
                        ifaceJson = JSON.parse(body);
                    } catch (ignore) {
                         // Agent not running or installed
                    }
                } else {
                    const resp = await fetch(url, { headers });
                    if (resp.ok) ifaceJson = await resp.json();
                }

                if (ifaceJson && ifaceJson.data) {
                   const ifaces = ifaceJson.data.result || [];
                   const ip = ifaces.find((i: any) => i.name !== 'lo' && i['ip-addresses'])?.['ip-addresses']?.find((ip: any) => ip['ip-address-type'] === 'ipv4')?.['ip-address'];
                   if (ip) service.ip = ip;
                }
            }
        } catch (e) {
            // Ignore IP fetch errors, not critical
            console.log(`[Proxmox] IP fetch warning for ${service.vmid}:`, e);
        }
    }));

    return {
        nodes,
        services: allServices,
        error: fetchErrors.length > 0 ? fetchErrors[0] : undefined
    };
}
