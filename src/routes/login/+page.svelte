<script lang="ts">
	let { form, data } = $props();
</script>

<svelte:head><title>Log in · MS Project Replica</title></svelte:head>


<main class="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-[7vw] py-12 lg:grid-cols-[minmax(0,1fr)_390px]">
	<section class="max-w-[35rem]">
		<p class="text-accent text-xs font-extrabold tracking-[0.18em]">MS PROJECT REPLICA</p>
		<h1 class="my-6 text-[clamp(3rem,7vw,6.5rem)] leading-[0.9] font-bold tracking-[-0.07em]">Welcome back.</h1>
		<p class="text-base-content/70 text-[1.1rem] leading-[1.6]">Keep the plan visible, the dates honest, and the team moving.</p>
	</section>

	<form method="POST" class="card card-border bg-base-100 shadow-xl gap-4 p-8">
		<h2 class="mb-2 text-[1.8rem] font-semibold tracking-[-0.04em]">Log in</h2>
		<input type="hidden" name="redirectTo" value={data.redirectTo} />
		{#if form?.error}
			<div class="alert alert-error alert-soft" role="alert"><span>{form.error}</span></div>
		{/if}
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
				autocomplete="current-password"
				required
			/>
		</fieldset>
		<button class="btn btn-primary btn-pill mt-2 w-full" type="submit">Log in</button>
		<p class="text-base-content/70 mt-2 text-center text-sm">
			New here? <a class="link link-hover text-primary font-bold" href={`/register?redirectTo=${encodeURIComponent(data.redirectTo)}`}
				>Create an account</a
			>
		</p>
	</form>
</main>
