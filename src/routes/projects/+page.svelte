<script lang="ts">
	let { data } = $props();
	let showForm = $state(false);
	let name = $state('');
	let startDate = $state(new Date().toISOString().slice(0, 10));
	let errorMessage = $state('');
	let saving = $state(false);

	async function createProject() {
		saving = true;
		errorMessage = '';
		const response = await fetch('/api/projects', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name, startDate })
		});
		if (!response.ok) {
			const payload = (await response.json()) as { error?: string };
			errorMessage = payload.error ?? 'Could not create project.';
			saving = false;
			return;
		}
		const created = (await response.json()) as { id: string };
		window.location.href = `/projects/${created.id}`;
	}
</script>

<svelte:head><title>Projects · MS Project Replica</title></svelte:head>

<main class="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-16">
	<header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-12">
		<div>
			<p class="text-accent text-xs font-extrabold tracking-[0.18em]">PROJECT WORKSPACE</p>
			<h1>Your projects</h1>
		</div>
		<button class="btn btn-primary btn-pill" onclick={() => (showForm = !showForm)}
			>＋ New project</button
		>
	</header>

	{#if showForm}
		<form
			class="card card-border bg-base-100 shadow-xl mb-8"
			onsubmit={(event) => {
				event.preventDefault();
				createProject();
			}}
		>
			<div class="card-body flex flex-row flex-wrap items-end gap-4">
				<fieldset class="fieldset min-w-0 flex-1 basis-56">
					<label class="fieldset-legend" for="project-name">Project name</label><input
						id="project-name"
						class="input input-bordered w-full"
						bind:value={name}
						placeholder="Website launch"
						required
					/>
				</fieldset>
				<fieldset class="fieldset min-w-0 flex-1 basis-56">
					<label class="fieldset-legend" for="project-start">Start date</label><input
						id="project-start"
						class="input input-bordered w-full"
						type="date"
						bind:value={startDate}
						required
					/>
				</fieldset>
				{#if errorMessage}
					<div class="alert alert-error alert-soft basis-full" role="alert">
						<span>{errorMessage}</span>
					</div>
				{/if}
				<button class="btn btn-primary btn-pill" disabled={saving}
					>{saving ? 'Creating…' : 'Create project'}</button
				>
			</div>
		</form>
	{/if}

	{#if data.projects.length === 0}
		<section class="card card-border bg-base-100 shadow-xl">
			<div class="card-body items-center text-center">
				<span class="text-accent text-3xl">✦</span>
				<h2>Nothing on the board yet.</h2>
				<p class="text-base-content/60">Create your first project and make the work visible.</p>
				<button class="btn btn-primary btn-pill" onclick={() => (showForm = true)}
					>Create a project</button
				>
			</div>
		</section>
	{:else}
		<section class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.projects as project}
				<a
					class="card card-border bg-base-100 shadow-md transition hover:-translate-y-0.5 hover:shadow-xl"
					href={`/projects/${project.id}`}
				>
					<div class="card-body">
						<div class="flex justify-between gap-2">
							<span class="badge badge-secondary badge-soft">{project.role}</span
							>{#if project.archivedAt}<span class="badge badge-error badge-soft">Archived</span
								>{/if}
						</div>
						<h2>{project.name}</h2>
						<p class="text-base-content/60">Started {project.startDate}</p>
						<span class="text-accent">Open workspace ↗</span>
					</div>
				</a>
			{/each}
		</section>
	{/if}
</main>
