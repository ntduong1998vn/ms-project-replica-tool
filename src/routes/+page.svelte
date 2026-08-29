<svelte:head>
	<title>MS Project Replica</title>
	<meta name="description" content="Team project planning workspace" />
</svelte:head>

<main>
	<p class="eyebrow">PROJECT WORKSPACE</p>
	<h1>Plan the work.<br /><span>See it move.</span></h1>
	<p class="lede">
		A focused project planning space for tasks, due dates and the people responsible for them.
	</p>
	<a class="button" href="/projects">Open projects</a>
</main>

<style>
	:global(body) {
		margin: 0;
		background: #f5f6f2;
		color: #17211b;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	main {
		box-sizing: border-box;
		min-height: 100vh;
		max-width: 760px;
		padding: 16vh 8vw;
	}
	.eyebrow {
		color: #d95f35;
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.18em;
	}
	h1 {
		font-size: clamp(3.5rem, 9vw, 7.5rem);
		letter-spacing: -0.07em;
		line-height: 0.9;
		margin: 2rem 0;
	}
	h1 span {
		color: #5e7666;
	}
	.lede {
		color: #58655c;
		font-size: 1.15rem;
		line-height: 1.6;
		max-width: 34rem;
	}
	.button {
		background: #17211b;
		border-radius: 999px;
		color: white;
		display: inline-block;
		font-weight: 700;
		margin-top: 1.5rem;
		padding: 0.9rem 1.3rem;
		text-decoration: none;
	}
</style>
