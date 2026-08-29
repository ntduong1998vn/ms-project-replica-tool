<script lang="ts">
	let { form, data } = $props();
</script>

<svelte:head><title>Create account · MS Project Replica</title></svelte:head>


<main class="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-[7vw] py-12 lg:grid-cols-[minmax(0,1fr)_390px]">
	<section class="max-w-[35rem]">
		<p class="text-accent text-xs font-extrabold tracking-[0.18em]">MS PROJECT REPLICA</p>
		<h1 class="my-6 text-[clamp(3rem,7vw,6.5rem)] leading-[0.9] font-bold tracking-[-0.07em]">Make the next move clear.</h1>
		<p class="text-base-content/70 text-[1.1rem] leading-[1.6]">Start a workspace for your team and give every task a date and an owner.</p>
	</section>

	<form method="POST" class="card card-border bg-base-100 shadow-xl gap-4 p-8">
		<h2 class="mb-2 text-[1.8rem] font-semibold tracking-[-0.04em]">Create account</h2>
		<input type="hidden" name="redirectTo" value={data.redirectTo} />
		{#if form?.error}
			<div class="alert alert-error alert-soft" role="alert"><span>{form.error}</span></div>
		{/if}
		<fieldset class="fieldset">
			<label class="fieldset-legend" for="name">Name</label>
			<input id="name" class="input w-full" name="name" autocomplete="name" required value={form?.name ?? ''} />
		</fieldset>
		<fieldset class="fieldset">
			<label class="fieldset-legend" for="email">Email</label>
			<input
				id="email"
				class="input w-full"
				name="email"
				type="email"
				autocomplete="email"
				required
				value={form?.email ?? ''}
			/>
		</fieldset>
		<fieldset class="fieldset">
			<label class="fieldset-legend" for="password">Password</label>
			<input
				id="password"
				class="input w-full"
				name="password"
				type="password"
				autocomplete="new-password"
				minlength="8"
				required
			/>
		</fieldset>
		<button class="btn btn-primary btn-pill mt-2 w-full" type="submit">Create account</button>
		<p class="text-base-content/70 mt-2 text-center text-sm">
			Already have an account? <a class="link link-hover text-primary font-bold" href={`/login?redirectTo=${encodeURIComponent(data.redirectTo)}`}
				>Log in</a
			>
		</p>
	</form>
</main>
