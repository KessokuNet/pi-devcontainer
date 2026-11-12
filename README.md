# pi-devcontainer

Pi extension: run project commands inside a project's devcontainer.

Fork of [`luxuride-pi-extensions/pi-devcontainer`](https://github.com/luxuride-pi-extensions/pi-devcontainer)
at v0.1.2 that adds Podman as a selectable container runtime. Nothing else
changed: Docker stays the default, so upstream behavior is untouched until the
runtime is set to `podman`.

`bash` stays on the host. This extension registers a `devcontainer` tool whose
commands run INSIDE the container, so the two filesystems never silently swap
under the model: the tool result reports both the container path it ran in and
the host path of the same directory, so `read`/`edit`/`write` can target the
same files from the host side.

## Tools

| Tool | What it does |
| --- | --- |
| `devcontainer` | Run a shell command inside the container (`bash -c`, with `cwd`, `stdin`, `timeout`, `tail`, `waitForContainer`). `project` targets another directory's container. |
| `create_devcontainer` | Create or edit `.devcontainer/devcontainer.json`. First call with no arguments reports the detected stack, the available base images and the ~1440-feature catalog from containers.dev; later calls write the image/features picked. `project` targets another directory. |
| `devcontainer_rebuild` | Re-run `devcontainer up` in the background after editing anything the image is built from. `project` targets another directory's config. |

The run tool is registered at startup but stays INACTIVE until the container is
actually up, so a project without a devcontainer sees no tool it cannot serve.

## How bring-up works

- If the project directory contains `.devcontainer/devcontainer.json` (or a
  bare `devcontainer.json`) and pi is not already inside a container:
  - with the `devcontainer` CLI, `devcontainer up` runs in the BACKGROUND at
    session start (never blocking the prompt); the first tool call awaits it,
    streaming pull/build progress into the tool row and the status bar. With
    `runtime: "podman"` every CLI call also carries `--docker-path podman`,
    which is what makes the CLI disable SELinux labeling and map the rootless
    uid;
  - without the CLI, a plain `docker run` (or `podman run`) fallback mounts
    the workspace at its host path and keeps the container alive — but only for
    image-based configs; build/dockerCompose configs require the CLI.
- Container ports are published on the host as the container opens them,
  announced as `container port -> host 127.0.0.1:<high port>` mappings. Host
  ports come from the ephemeral range so nothing already listening is
  displaced; the run tool's result and `/devcontainer-ports` report the
  mapping, since `localhost:<container port>` is NOT the container's service.

## Other projects

A session anchored in one project can also work in a sibling checkout whose
devcontainer is different. Pass the host directory as the tools' `project`
parameter (absolute, or relative to the session directory) — relative paths
resolve against the session directory. The first bring-up for that directory
still has to happen once: either by starting a session there, or by calling
`create_devcontainer` with `project` pointed at it. Afterwards `devcontainer`,
`create_devcontainer` and `devcontainer_rebuild` all accept `project`, each
project keeps its own container, config and port mappings, and the run tool
reports the `project` it targeted. Omitting `project` keeps every tool
anchored to the session's own project.

## Session commands

- `/devcontainer` — watch what the bring-up is doing right now.
- `/devcontainer-ports` — list the container ports published on the host,
  across every project this session brought up.

## Global override

`~/.devcontainer/pi-override.json` (JSONC) is applied to every project's
devcontainer:

```jsonc
{
  "runtime": "podman",      // docker (default) or podman
  "features": { /* merged via devcontainer up --additional-features */ },
  "provision": [ "bash -lc command lines run once per container" ]
}
```

`PI_DEVCONTAINER_RUNTIME=podman` overrides the file for one run, so switching
runtimes does not need an edit.

Provisioning is idempotent (marker file in the container's `$HOME`) and
best-effort: a failure warns and the tools stay available.

## Podman

Set `"runtime": "podman"` in the global override (or export
`PI_DEVCONTAINER_RUNTIME=podman`). Every runtime call — `up`, `exec`, `ps`,
`inspect`, provisioning and port forwarding — then goes through `podman`
instead of `docker`, and the CLI is passed `--docker-path podman` on each
invocation. Requires Podman 4 or newer and the devcontainer CLI
(`npm install -g @devcontainers/cli`, 0.90 tested).

Rootless Podman needs care with file ownership: the container runs as the
image's user, and anything other than root cannot write the host-owned
workspace through the default userns mapping. Add the mapping to the project
config when the container user is not root:

```jsonc
{ "runArgs": ["--userns=keep-id"] }
```

Two things still differ from Docker, both from rootless networking and
building:

- Automatic port relaying is skipped when the runtime reports no
  host-routable container IP (pasta/bridge under rootless Podman). Declare the
  ports in `devcontainer.json` `forwardPorts` instead — the CLI publishes them
  with `-p` at `up` time.
- Feature and Dockerfile builds run through `podman build`; the CLI's BuildKit
  path needs `buildx`, which Podman does not provide. Image-only configs are
  unaffected.

## Install

```bash
pi install /path/to/pi-devcontainer
```

The extension is TypeScript loaded from source; there is no build step.


## License

MIT
