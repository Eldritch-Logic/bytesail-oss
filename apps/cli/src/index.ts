#!/usr/bin/env bun
import { Command } from "commander";

const program = new Command();

program
	.name("bytesail")
	.description("ByteSail CLI — deploy and manage your applications")
	.version("0.0.1")
	.option("--json", "Output results as JSON")
	.option("--yes", "Skip confirmation prompts");

import { registerAuthCommands } from "./commands/auth.js";
import { registerCompletionCommands } from "./commands/completion.js";
import { registerComposeCommands } from "./commands/compose.js";
import { registerDatabaseCommands } from "./commands/database.js";
import { registerDeployCommands } from "./commands/deploy.js";
import { registerDomainCommands } from "./commands/domain.js";
import { registerEnvCommands } from "./commands/env.js";
import { registerLogCommands } from "./commands/logs.js";
import { registerNodeCommands } from "./commands/node.js";
import { registerOpenCommands } from "./commands/open.js";
import { registerProjectCommands } from "./commands/project.js";
import { registerRunCommands } from "./commands/run.js";
import { registerServiceCommands } from "./commands/service.js";
import { registerShellCommands } from "./commands/shell.js";
import { registerStatusCommands } from "./commands/status.js";
import { registerUpdateCommands } from "./commands/update.js";
import { registerVolumeCommands } from "./commands/volume.js";

registerAuthCommands(program);
registerProjectCommands(program);
registerServiceCommands(program);
registerDeployCommands(program);
registerEnvCommands(program);
registerLogCommands(program);
registerDomainCommands(program);
registerVolumeCommands(program);
registerComposeCommands(program);
registerDatabaseCommands(program);
registerShellCommands(program);
registerOpenCommands(program);
registerStatusCommands(program);
registerRunCommands(program);
registerCompletionCommands(program);
registerNodeCommands(program);
registerUpdateCommands(program);

program.parse();
