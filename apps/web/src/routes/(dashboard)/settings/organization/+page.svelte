<script lang="ts">
import { authClient } from "@bytesail/auth/client";
import { Clock, Mail, MoreVertical, Plus, Shield, Trash2, UserPlus, Users } from "@lucide/svelte";
import { onMount } from "svelte";
import { toastError, toastSuccess } from "$lib/components/notifications/toast.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";

type Member = {
	id: string;
	userId: string;
	role: string;
	createdAt: string;
	user: { name: string; email: string; image?: string | null };
};

type Invitation = {
	id: string;
	email: string;
	role: string;
	status: string;
	createdAt: string;
};

type Organization = {
	id: string;
	name: string;
	slug: string;
	logo?: string | null;
	members: Member[];
	invitations: Invitation[];
};

let org = $state<Organization | null>(null);
let loading = $state(true);

// Edit state
let editName = $state("");
let saving = $state(false);

// Invite dialog
let showInvite = $state(false);
let inviteEmail = $state("");
let inviteRole = $state("member");
let inviting = $state(false);

// Delete confirm
let deleteConfirmId = $state<string | null>(null);
let revokeConfirmId = $state<string | null>(null);

const roleOptions = [
	{ value: "owner", label: "Owner", color: "text-amber-400" },
	{ value: "admin", label: "Admin", color: "text-blue-400" },
	{ value: "member", label: "Member", color: "text-foreground" },
];

function roleColor(role: string): string {
	return roleOptions.find((r) => r.value === role)?.color ?? "text-foreground";
}

function formatDate(date: string): string {
	return new Date(date).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((n) => n[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

async function loadOrg() {
	loading = true;
	try {
		const result = await authClient.organization.getFullOrganization();
		if (result.data) {
			org = result.data as unknown as Organization;
			editName = org.name;
		}
	} catch (e) {
		toastError("Failed to load organization");
	} finally {
		loading = false;
	}
}

async function saveName() {
	if (!org || !editName.trim() || editName === org.name) return;
	saving = true;
	try {
		await authClient.organization.update({
			data: { name: editName.trim() },
		});
		toastSuccess("Organization name updated");
		await loadOrg();
	} catch (e) {
		toastError("Failed to update organization");
	} finally {
		saving = false;
	}
}

async function handleInvite() {
	if (!inviteEmail.trim()) return;
	inviting = true;
	try {
		await authClient.organization.inviteMember({
			email: inviteEmail.trim(),
			role: inviteRole as "admin" | "member",
		});
		toastSuccess("Invitation sent", `Invited ${inviteEmail.trim()}`);
		inviteEmail = "";
		inviteRole = "member";
		showInvite = false;
		await loadOrg();
	} catch (e) {
		toastError("Failed to send invitation", e instanceof Error ? e.message : "");
	} finally {
		inviting = false;
	}
}

async function handleRoleChange(memberId: string, newRole: string) {
	try {
		await authClient.organization.updateMemberRole({
			memberId,
			role: newRole as "admin" | "member" | "owner",
		});
		toastSuccess("Role updated");
		await loadOrg();
	} catch (e) {
		toastError("Failed to update role", e instanceof Error ? e.message : "");
	}
}

async function handleRemoveMember(memberId: string) {
	try {
		await authClient.organization.removeMember({ memberIdOrEmail: memberId });
		deleteConfirmId = null;
		toastSuccess("Member removed");
		await loadOrg();
	} catch (e) {
		toastError("Failed to remove member", e instanceof Error ? e.message : "");
	}
}

async function handleRevokeInvitation(invitationId: string) {
	try {
		await authClient.organization.cancelInvitation({ invitationId });
		revokeConfirmId = null;
		toastSuccess("Invitation revoked");
		await loadOrg();
	} catch (e) {
		toastError("Failed to revoke invitation", e instanceof Error ? e.message : "");
	}
}

onMount(loadOrg);
</script>

<div class="space-y-6">
	<div>
		<h2 class="text-lg font-semibold">Organization</h2>
		<p class="mt-1 text-sm text-muted-foreground">Manage your organization settings, members, and invitations.</p>
	</div>

	{#if loading}
		<div class="space-y-4">
			{#each Array(3) as _}
				<div class="h-20 animate-pulse rounded-lg border border-border bg-muted/30"></div>
			{/each}
		</div>
	{:else if org}
		<!-- Organization Info -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="text-sm">General</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="space-y-2">
						<label for="org-name" class="text-sm font-medium">Organization Name</label>
						<div class="flex gap-2">
							<Input id="org-name" bind:value={editName} />
							<Button
								size="sm"
								onclick={saveName}
								disabled={saving || !editName.trim() || editName === org.name}
							>
								{saving ? "Saving..." : "Save"}
							</Button>
						</div>
					</div>
					<div class="space-y-2">
						<label class="text-sm font-medium">Slug</label>
						<p class="flex h-9 items-center rounded-md border border-border bg-muted/30 px-3 text-sm text-muted-foreground">
							{org.slug}
						</p>
					</div>
				</div>

				{#if org.logo}
					<div class="space-y-2">
						<label class="text-sm font-medium">Logo</label>
						<img src={org.logo} alt="{org.name} logo" class="size-16 rounded-lg border border-border object-cover" />
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<!-- Members -->
		<Card.Root>
			<Card.Header>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Users class="size-4 text-muted-foreground" />
						<Card.Title class="text-sm">Members ({org.members.length})</Card.Title>
					</div>
					<Button size="sm" onclick={() => (showInvite = true)}>
						<UserPlus class="mr-1.5 size-3.5" />
						Invite Member
					</Button>
				</div>
			</Card.Header>
			<Card.Content>
				<div class="overflow-x-auto rounded-lg border border-border">
					<table class="w-full min-w-[500px] text-sm">
						<thead>
							<tr class="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
								<th class="px-3 py-2.5">Member</th>
								<th class="px-3 py-2.5">Role</th>
								<th class="px-3 py-2.5">Joined</th>
								<th class="w-20 px-3 py-2.5"></th>
							</tr>
						</thead>
						<tbody>
							{#each org.members as member}
								<tr class="border-b border-border last:border-0">
									<td class="px-3 py-2.5">
										<div class="flex items-center gap-3">
											{#if member.user.image}
												<img
													src={member.user.image}
													alt={member.user.name}
													class="size-8 rounded-full object-cover"
												/>
											{:else}
												<div class="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
													{getInitials(member.user.name)}
												</div>
											{/if}
											<div>
												<p class="text-sm font-medium">{member.user.name}</p>
												<p class="text-2xs text-muted-foreground">{member.user.email}</p>
											</div>
										</div>
									</td>
									<td class="px-3 py-2.5">
										{#if member.role === "owner"}
											<Badge variant="outline" class="text-2xs capitalize {roleColor(member.role)}">
												<Shield class="mr-1 size-3" />
												{member.role}
											</Badge>
										{:else}
											<select
												value={member.role}
												onchange={(e) => handleRoleChange(member.id, (e.target as HTMLSelectElement).value)}
												class="h-7 rounded-md border border-input bg-background px-2 text-xs"
											>
												<option value="admin">Admin</option>
												<option value="member">Member</option>
											</select>
										{/if}
									</td>
									<td class="px-3 py-2.5 text-xs text-muted-foreground">
										{formatDate(member.createdAt)}
									</td>
									<td class="px-3 py-2.5">
										{#if member.role !== "owner"}
											{#if deleteConfirmId === member.id}
												<div class="flex gap-1">
													<Button variant="destructive" size="sm" class="h-7 text-xs" onclick={() => handleRemoveMember(member.id)}>
														Remove
													</Button>
													<Button variant="ghost" size="sm" class="h-7 text-xs" onclick={() => (deleteConfirmId = null)}>
														Cancel
													</Button>
												</div>
											{:else}
												<Button variant="ghost" size="sm" class="h-7" onclick={() => (deleteConfirmId = member.id)}>
													<Trash2 class="size-3.5 text-destructive" />
												</Button>
											{/if}
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Pending Invitations -->
		{#if org.invitations.length > 0}
			<Card.Root>
				<Card.Header>
					<div class="flex items-center gap-2">
						<Mail class="size-4 text-muted-foreground" />
						<Card.Title class="text-sm">Pending Invitations ({org.invitations.filter((i) => i.status === "pending").length})</Card.Title>
					</div>
				</Card.Header>
				<Card.Content>
					<div class="space-y-2">
						{#each org.invitations.filter((i) => i.status === "pending") as invitation}
							<div class="flex items-center justify-between rounded-lg border border-border p-3">
								<div class="flex items-center gap-3">
									<div class="flex size-8 items-center justify-center rounded-full bg-muted">
										<Mail class="size-3.5 text-muted-foreground" />
									</div>
									<div>
										<p class="text-sm">{invitation.email}</p>
										<div class="flex items-center gap-2 text-2xs text-muted-foreground">
											<Badge variant="outline" class="text-2xs capitalize">{invitation.role}</Badge>
											<span class="flex items-center gap-1">
												<Clock class="size-3" />
												Sent {formatDate(invitation.createdAt)}
											</span>
										</div>
									</div>
								</div>
								{#if revokeConfirmId === invitation.id}
									<div class="flex gap-1">
										<Button variant="destructive" size="sm" class="h-7 text-xs" onclick={() => handleRevokeInvitation(invitation.id)}>
											Revoke
										</Button>
										<Button variant="ghost" size="sm" class="h-7 text-xs" onclick={() => (revokeConfirmId = null)}>
											Cancel
										</Button>
									</div>
								{:else}
									<Button variant="ghost" size="sm" class="h-7" onclick={() => (revokeConfirmId = invitation.id)}>
										<Trash2 class="size-3.5 text-destructive" />
									</Button>
								{/if}
							</div>
						{/each}
					</div>
				</Card.Content>
			</Card.Root>
		{/if}
	{:else}
		<Card.Root>
			<Card.Content class="flex flex-col items-center gap-3 py-12 text-center">
				<Users class="size-10 text-muted-foreground/50" />
				<p class="text-sm font-medium">No organization</p>
				<p class="text-xs text-muted-foreground">You are not part of any organization.</p>
			</Card.Content>
		</Card.Root>
	{/if}
</div>

<!-- Invite Dialog -->
{#if showInvite}
	<button type="button" class="fixed inset-0 z-40 bg-black/50" onclick={() => (showInvite = false)} aria-label="Close"></button>
	<div class="fixed inset-x-3 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-xl border border-border bg-background p-4 shadow-2xl sm:inset-x-auto sm:left-1/2 sm:w-full sm:-translate-x-1/2 sm:p-6">
		<h3 class="text-lg font-semibold">Invite Member</h3>
		<p class="mt-1 text-sm text-muted-foreground">Send an invitation to join your organization.</p>

		<div class="mt-4 space-y-4">
			<div class="space-y-2">
				<label for="invite-email" class="text-sm font-medium">Email</label>
				<Input id="invite-email" type="email" bind:value={inviteEmail} placeholder="colleague@example.com" />
			</div>

			<div class="space-y-2">
				<label for="invite-role" class="text-sm font-medium">Role</label>
				<select
					id="invite-role"
					bind:value={inviteRole}
					class="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
				>
					<option value="admin">Admin</option>
					<option value="member">Member</option>
				</select>
				<p class="text-2xs text-muted-foreground">
					{inviteRole === "admin" ? "Admins can manage projects, services, and settings." : "Members can view and deploy but cannot change settings."}
				</p>
			</div>

			<div class="flex gap-2 pt-2">
				<Button onclick={handleInvite} disabled={inviting || !inviteEmail.trim()} class="flex-1">
					<UserPlus class="mr-1.5 size-3.5" />
					{inviting ? "Sending..." : "Send Invitation"}
				</Button>
				<Button variant="ghost" onclick={() => (showInvite = false)}>Cancel</Button>
			</div>
		</div>
	</div>
{/if}
