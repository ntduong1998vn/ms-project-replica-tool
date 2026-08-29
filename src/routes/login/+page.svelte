<script lang="ts">
	let { form } = $props();
</script>

<svelte:head><title>Log in · MS Project Replica</title></svelte:head>

<main class="auth-shell">
	<section class="intro">
		<p class="eyebrow">MS PROJECT REPLICA</p>
		<h1>Welcome back.</h1>
		<p>Keep the plan visible, the dates honest, and the team moving.</p>
	</section>

	<form method="POST" class="auth-card">
		<h2>Log in</h2>
		{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
		<label
			>Email <input
				name="email"
				type="email"
				autocomplete="email"
				required
				value={form?.email ?? ''}
			/></label
		>
		<label
			>Password <input
				name="password"
				type="password"
				autocomplete="current-password"
				required
			/></label
		>
		<button type="submit">Log in</button>
		<p class="switch">New here? <a href="/register">Create an account</a></p>
	</form>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #f5f6f2;
		color: #17211b;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	.auth-shell {
		align-items: center;
		display: grid;
		gap: 5rem;
		grid-template-columns: minmax(0, 1fr) minmax(280px, 390px);
		margin: 0 auto;
		max-width: 1100px;
		min-height: 100vh;
		padding: 3rem 7vw;
	}
	.intro {
		max-width: 35rem;
	}
	.eyebrow {
		color: #d95f35;
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.18em;
	}
	h1 {
		font-size: clamp(3rem, 7vw, 6.5rem);
		letter-spacing: -0.07em;
		line-height: 0.9;
		margin: 1.5rem 0;
	}
	.intro p:last-child {
		color: #58655c;
		font-size: 1.1rem;
		line-height: 1.6;
	}
	.auth-card {
		background: white;
		border: 1px solid #dfe4dd;
		border-radius: 1.5rem;
		box-shadow: 0 1rem 3rem #26372b12;
		display: grid;
		gap: 1rem;
		padding: 2rem;
	}
	h2 {
		font-size: 1.8rem;
		letter-spacing: -0.04em;
		margin: 0 0 0.5rem;
	}
	label {
		display: grid;
		font-size: 0.85rem;
		font-weight: 700;
		gap: 0.45rem;
	}
	input {
		border: 1px solid #ccd5cc;
		border-radius: 0.65rem;
		box-sizing: border-box;
		font: inherit;
		padding: 0.8rem 0.85rem;
		width: 100%;
	}
	button {
		background: #17211b;
		border: 0;
		border-radius: 999px;
		color: white;
		cursor: pointer;
		font: inherit;
		font-weight: 700;
		margin-top: 0.5rem;
		padding: 0.85rem 1rem;
	}
	.error {
		background: #fff0eb;
		border-radius: 0.55rem;
		color: #a53e20;
		font-size: 0.9rem;
		margin: 0;
		padding: 0.7rem 0.8rem;
	}
	.switch {
		color: #58655c;
		font-size: 0.9rem;
		margin: 0.5rem 0 0;
		text-align: center;
	}
	a {
		color: #b94f2d;
		font-weight: 700;
	}
	@media (max-width: 720px) {
		.auth-shell {
			gap: 2rem;
			grid-template-columns: 1fr;
			padding: 2rem 1.25rem;
		}
	}
</style>
