<script lang="ts">
	let { data, form } = $props();
</script>

<svelte:head><title>Join project · MS Project Replica</title></svelte:head>

<main class="grid min-h-screen place-items-center p-6">
	<section class="card card-border bg-base-100 shadow-xl max-w-[520px] p-12">
		<p class="text-accent text-xs font-extrabold tracking-[0.18em]">YOU'RE INVITED</p>
		{#if data.invite}
			<h1 class="my-6 text-[clamp(2.5rem,8vw,5rem)] leading-[0.95] font-bold tracking-[-0.07em]">Join {data.invite.projectName}.</h1>
			<p class="text-base-content/70 leading-[1.6]">You'll join this workspace as a <strong>{data.invite.role}</strong>.</p>
			{#if form?.error}
				<div class="alert alert-error alert-soft" role="alert"><span>{form.error}</span></div>
			{/if}
			<form method="POST"><button class="btn btn-primary btn-pill" type="submit">Accept invite</button></form>
		{:else}
			<h1 class="my-6 text-[clamp(2.5rem,8vw,5rem)] leading-[0.95] font-bold tracking-[-0.07em]">This link has gone quiet.</h1>
			<p class="text-base-content/70 leading-[1.6]">The invite is already used or has expired. Ask a project manager for a fresh link.</p>
		{/if}
	</section>
</main>
