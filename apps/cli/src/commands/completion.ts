import chalk from "chalk";
import type { Command } from "commander";

const BASH_COMPLETION = `_bytesail() {
  local cur prev words cword
  _init_completion || return

  local commands="login logout whoami project service deploy env logs domain volume compose database shell open status run node update completion"

  if [[ $cword -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
    return
  fi

  case "\${words[1]}" in
    project)
      COMPREPLY=( $(compgen -W "list create delete link" -- "$cur") )
      ;;
    service)
      COMPREPLY=( $(compgen -W "list create delete info restart" -- "$cur") )
      ;;
    env)
      COMPREPLY=( $(compgen -W "list set unset import" -- "$cur") )
      ;;
    domain)
      COMPREPLY=( $(compgen -W "list add remove" -- "$cur") )
      ;;
    volume)
      COMPREPLY=( $(compgen -W "list create delete" -- "$cur") )
      ;;
    database)
      COMPREPLY=( $(compgen -W "list create delete connect" -- "$cur") )
      ;;
    node)
      COMPREPLY=( $(compgen -W "list add remove" -- "$cur") )
      ;;
    update)
      COMPREPLY=( $(compgen -W "check apply status" -- "$cur") )
      ;;
    completion)
      COMPREPLY=( $(compgen -W "bash zsh fish" -- "$cur") )
      ;;
  esac
}
complete -F _bytesail bytesail`;

const ZSH_COMPLETION = `#compdef bytesail

_bytesail() {
  local -a commands
  commands=(
    'login:Authenticate with a ByteSail instance'
    'logout:Clear saved credentials'
    'whoami:Show current authenticated user'
    'project:Manage projects'
    'service:Manage services'
    'deploy:Deploy a service'
    'env:Manage environment variables'
    'logs:View service logs'
    'domain:Manage custom domains'
    'volume:Manage persistent volumes'
    'compose:Deploy from docker-compose.yml'
    'database:Manage databases'
    'shell:Open a shell in a running service'
    'open:Open service in browser'
    'status:Show system and project status'
    'run:Run a one-off command'
    'node:Manage cluster nodes'
    'update:Manage ByteSail updates'
    'completion:Generate shell completions'
  )

  _arguments -C \\
    '--json[Output results as JSON]' \\
    '--yes[Skip confirmation prompts]' \\
    '1:command:->command' \\
    '*::arg:->args'

  case $state in
    command)
      _describe -t commands 'bytesail command' commands
      ;;
    args)
      case $words[1] in
        project)
          _describe -t subcommands 'subcommand' '(list create delete link)'
          ;;
        service)
          _describe -t subcommands 'subcommand' '(list create delete info restart)'
          ;;
        env)
          _describe -t subcommands 'subcommand' '(list set unset import)'
          ;;
        domain)
          _describe -t subcommands 'subcommand' '(list add remove)'
          ;;
        volume)
          _describe -t subcommands 'subcommand' '(list create delete)'
          ;;
        database)
          _describe -t subcommands 'subcommand' '(list create delete connect)'
          ;;
        node)
          _describe -t subcommands 'subcommand' '(list add remove)'
          ;;
        update)
          _describe -t subcommands 'subcommand' '(check apply status)'
          ;;
        completion)
          _describe -t subcommands 'subcommand' '(bash zsh fish)'
          ;;
      esac
      ;;
  esac
}

compdef _bytesail bytesail`;

const FISH_COMPLETION = `# bytesail fish completions
complete -c bytesail -n '__fish_use_subcommand' -a login -d 'Authenticate with a ByteSail instance'
complete -c bytesail -n '__fish_use_subcommand' -a logout -d 'Clear saved credentials'
complete -c bytesail -n '__fish_use_subcommand' -a whoami -d 'Show current authenticated user'
complete -c bytesail -n '__fish_use_subcommand' -a project -d 'Manage projects'
complete -c bytesail -n '__fish_use_subcommand' -a service -d 'Manage services'
complete -c bytesail -n '__fish_use_subcommand' -a deploy -d 'Deploy a service'
complete -c bytesail -n '__fish_use_subcommand' -a env -d 'Manage environment variables'
complete -c bytesail -n '__fish_use_subcommand' -a logs -d 'View service logs'
complete -c bytesail -n '__fish_use_subcommand' -a domain -d 'Manage custom domains'
complete -c bytesail -n '__fish_use_subcommand' -a volume -d 'Manage persistent volumes'
complete -c bytesail -n '__fish_use_subcommand' -a compose -d 'Deploy from docker-compose.yml'
complete -c bytesail -n '__fish_use_subcommand' -a database -d 'Manage databases'
complete -c bytesail -n '__fish_use_subcommand' -a shell -d 'Open a shell in a running service'
complete -c bytesail -n '__fish_use_subcommand' -a open -d 'Open service in browser'
complete -c bytesail -n '__fish_use_subcommand' -a status -d 'Show system and project status'
complete -c bytesail -n '__fish_use_subcommand' -a run -d 'Run a one-off command'
complete -c bytesail -n '__fish_use_subcommand' -a node -d 'Manage cluster nodes'
complete -c bytesail -n '__fish_use_subcommand' -a update -d 'Manage ByteSail updates'
complete -c bytesail -n '__fish_use_subcommand' -a completion -d 'Generate shell completions'

# project subcommands
complete -c bytesail -n '__fish_seen_subcommand_from project' -a 'list create delete link'

# service subcommands
complete -c bytesail -n '__fish_seen_subcommand_from service' -a 'list create delete info restart'

# env subcommands
complete -c bytesail -n '__fish_seen_subcommand_from env' -a 'list set unset import'

# domain subcommands
complete -c bytesail -n '__fish_seen_subcommand_from domain' -a 'list add remove'

# volume subcommands
complete -c bytesail -n '__fish_seen_subcommand_from volume' -a 'list create delete'

# database subcommands
complete -c bytesail -n '__fish_seen_subcommand_from database' -a 'list create delete connect'

# node subcommands
complete -c bytesail -n '__fish_seen_subcommand_from node' -a 'list add remove'

# update subcommands
complete -c bytesail -n '__fish_seen_subcommand_from update' -a 'check apply status'

# completion subcommands
complete -c bytesail -n '__fish_seen_subcommand_from completion' -a 'bash zsh fish'`;

const INSTALL_INSTRUCTIONS: Record<string, string> = {
	bash: `# Add to ~/.bashrc:
#   eval "$(bytesail completion bash)"
# Or save to a file:
#   bytesail completion bash > /etc/bash_completion.d/bytesail`,
	zsh: `# Add to ~/.zshrc:
#   eval "$(bytesail completion zsh)"
# Or save to a file:
#   bytesail completion zsh > ~/.zfunc/_bytesail
#   (make sure ~/.zfunc is in your fpath)`,
	fish: `# Save to completions directory:
#   bytesail completion fish > ~/.config/fish/completions/bytesail.fish`,
};

export function registerCompletionCommands(program: Command) {
	program
		.command("completion")
		.description("Generate shell completion scripts")
		.argument("<shell>", "Shell type: bash, zsh, or fish")
		.action((shell: string) => {
			const normalized = shell.toLowerCase();

			switch (normalized) {
				case "bash":
					console.log(BASH_COMPLETION);
					break;
				case "zsh":
					console.log(ZSH_COMPLETION);
					break;
				case "fish":
					console.log(FISH_COMPLETION);
					break;
				default:
					console.log(
						chalk.red(`Unknown shell: ${shell}.`),
						"Supported shells:",
						chalk.cyan("bash"),
						chalk.cyan("zsh"),
						chalk.cyan("fish"),
					);
					process.exit(1);
			}

			const instructions = INSTALL_INSTRUCTIONS[normalized];
			if (instructions) {
				console.log();
				console.log(chalk.dim(instructions));
			}
		});
}
