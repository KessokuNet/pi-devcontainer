import type { ContainerRuntime } from "./types.js";

/** The binary that drives this project's containers. Undefined is docker. */
export function runtimeBin(runtime: ContainerRuntime | undefined): ContainerRuntime {
	return runtime ?? "docker";
}

/** `--docker-path podman`; the CLI derives its cliVariant from it, which drives SELinux labels, uid mapping and image naming. */
export function cliRuntimeArgs(runtime: ContainerRuntime | undefined): string[] {
	return runtimeBin(runtime) === "podman" ? ["--docker-path", "podman"] : [];
}

export function parseRuntime(value: unknown): ContainerRuntime | undefined {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim().toLowerCase();
	return normalized === "docker" || normalized === "podman" ? normalized : undefined;
}

/** PI_DEVCONTAINER_RUNTIME wins over the override file, for a one-run switch. */
export function resolveRuntime(fromOverride: ContainerRuntime | undefined): ContainerRuntime {
	return parseRuntime(process.env.PI_DEVCONTAINER_RUNTIME) ?? fromOverride ?? "docker";
}
