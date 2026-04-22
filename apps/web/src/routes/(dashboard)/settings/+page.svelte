<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { Label } from "$lib/components/ui/label/index.js";

let instanceName = $state("ByteSail");
let baseDomain = $state("");
</script>

<div class="space-y-6">
	<Card.Root>
		<Card.Header>
			<Card.Title>Instance Settings</Card.Title>
			<Card.Description>Configure your ByteSail instance.</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="space-y-2">
				<Label for="instance-name">Instance name</Label>
				<Input id="instance-name" bind:value={instanceName} />
			</div>
			<div class="space-y-2">
				<Label for="base-domain">Base domain</Label>
				<Input id="base-domain" bind:value={baseDomain} placeholder="bytesail.example.com" />
			</div>
		</Card.Content>
		<Card.Footer>
			<Button>Save Changes</Button>
		</Card.Footer>
	</Card.Root>
</div>
