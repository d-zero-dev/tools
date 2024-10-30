# `@d-zero/proc-talk`

`@d-zero/proc-talk` is a Node.js library that streamlines child-process management and inter-process communication (IPC) by providing a simple interface for coordinating bidirectional communication between a main process and child processes. With `ProcTalk`, developers can easily fork child processes, send tasks asynchronously, and exchange messages or data between processes without complex setup.

## Installation

```bash
npm install @d-zero/proc-talk
```

## `ProcTalk` Class Overview

The `ProcTalk` class is designed to simplify child-process management and communication within Node.js applications. It allows you to fork and manage child processes from a main process, send asynchronous tasks, and relay messages between processes. `ProcTalk` is ideal for applications that benefit from offloading tasks to child-processes, enhancing performance without the overhead of low-level process management.

### Key Features

- **Fork and Manage Child-Processes**: Easily create and manage child-processes using Node's `child_process.fork`.
- **Asynchronous Task Handling**: Send tasks from the main process to child-processes and receive results asynchronously using Promises, enabling seamless parallel processing.
- **Bidirectional Message Passing**: Supports message passing between processes with serialization and deserialization for handling complex data structures.
- **Process Lifecycle Management**: Manages process initialization and cleanup to ensure reliable communication throughout the process lifecycle.

### Example Use Cases

- **Offload Background Processing**: Delegate resource-intensive tasks to child-processes to reduce the main process load.
- **Improve Responsiveness**: Execute specific tasks in child-processes to prevent blocking the main process and maintain application responsiveness.
- **Simple child-Process Integration**: Easily manage tasks and data exchange with child-processes, allowing the main process to distribute workloads effectively.
