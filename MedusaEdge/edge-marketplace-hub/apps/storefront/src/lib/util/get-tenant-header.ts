export async function getTenantHeader() {
  try {
    const mod = await import("next/headers")
    const headerStore = await mod.headers()
    const host = headerStore.get("host")?.split(":")[0].toLowerCase() || ""

    if (host.endsWith(".localhost")) {
      const slug = host.replace(/\.localhost$/, "")
      if (slug && slug !== "www") {
        return { "x-edge-tenant": slug } as const
      }
    }

    if (host.endsWith(".127.0.0.1.nip.io")) {
      const slug = host.replace(/\.127\.0\.0\.1\.nip\.io$/, "")
      if (slug && slug !== "www") {
        return { "x-edge-tenant": slug } as const
      }
    }

    const cookieStore = await mod.cookies()
    const tenant = cookieStore.get("_edge_tenant")?.value
    if (tenant) {
      return { "x-edge-tenant": tenant } as const
    }
  } catch {}

  try {
    if (typeof document !== "undefined") {
      const match = document.cookie
        .split(";")
        .map((p) => p.trim())
        .find((p) => p.startsWith("_edge_tenant="))

      if (match) {
        const tenant = decodeURIComponent(match.split("=")[1] || "")
        if (tenant) {
          return { "x-edge-tenant": tenant } as const
        }
      }
    }
  } catch {}

  return {} as const
}
