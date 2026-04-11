/**
 * Nexus Antigravity Physics Core
 * Integrates Matter.js with DOM elements to create a floating zero-g effect.
 */
(function() {
    let active = false;
    let engine, render, runner;
    let bodies = [];

    const initPhysics = () => {
        const { Engine, Render, Runner, Bodies, Composite, Mouse, MouseConstraint } = Matter;
        engine = Engine.create();
        engine.gravity.y = 0; // Zero gravity

        const panels = document.querySelectorAll('.panel');
        panels.forEach(el => {
            const rect = el.getBoundingClientRect();
            const body = Bodies.rectangle(
                rect.left + rect.width / 2,
                rect.top + rect.height / 2,
                rect.width,
                rect.height,
                { frictionAir: 0.05, restitution: 0.8 }
            );
            body.element = el;
            bodies.push(body);
            el.style.position = 'fixed';
            el.style.width = rect.width + 'px';
            el.style.margin = '0';
            el.style.zIndex = '1000';
        });

        // Add boundaries
        const wallOptions = { isStatic: true, render: { visible: false } };
        Composite.add(engine.world, [
            Bodies.rectangle(window.innerWidth / 2, -50, window.innerWidth, 100, wallOptions),
            Bodies.rectangle(window.innerWidth / 2, window.innerHeight + 50, window.innerWidth, 100, wallOptions),
            Bodies.rectangle(-50, window.innerHeight / 2, 100, window.innerHeight, wallOptions),
            Bodies.rectangle(window.innerWidth + 50, window.innerHeight / 2, 100, window.innerHeight, wallOptions),
            ...bodies
        ]);

        const mouse = Mouse.create(document.body);
        const mouseConstraint = MouseConstraint.create(engine, {
            mouse: mouse,
            constraint: { stiffness: 0.2, render: { visible: false } }
        });
        Composite.add(engine.world, mouseConstraint);

        runner = Runner.create();
        Runner.run(runner, engine);

        const update = () => {
            if (!active) return;
            bodies.forEach(b => {
                const { x, y } = b.position;
                b.element.style.transform = `translate(${x - b.element.offsetWidth / 2 - parseFloat(b.element.style.left || 0)}px, ${y - b.element.offsetHeight / 2 - parseFloat(b.element.style.top || 0)}px) rotate(${b.angle}rad)`;
            });
            requestAnimationFrame(update);
        };
        update();

        // Give them a little push
        bodies.forEach(b => {
            Matter.Body.applyForce(b, b.position, { 
                x: (Math.random() - 0.5) * 0.1, 
                y: (Math.random() - 0.5) * 0.1 
            });
        });
    };

    const stopPhysics = () => {
        if (runner) Matter.Runner.stop(runner);
        bodies.forEach(b => {
           b.element.style.position = '';
           b.element.style.transform = '';
           b.element.style.width = '';
        });
        bodies = [];
    };

    document.addEventListener('click', (e) => {
        if (e.target.id === 'phyToggle') {
            active = !active;
            e.target.textContent = active ? '[ PHY: ACTIVE ]' : '[ PHY: OFF ]';
            e.target.style.color = active ? 'var(--c)' : 'var(--y)';
            if (active) {
                initPhysics();
                if(typeof showToast === 'function') showToast("ANTIGRAVITY STABILIZERS DISENGAGED.", "warning");
            } else {
                stopPhysics();
                location.reload(); // Simplest way to reset DOM layout
            }
        }
    });

})();
