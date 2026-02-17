
        // Initialize GSAP
        gsap.registerPlugin(ScrollTrigger);

        // 1. Mobile Menu Logic
        const mobileToggle = document.getElementById('mobileToggle');
        const navLinks = document.getElementById('navLinks');
        const body = document.body;

        mobileToggle.addEventListener('click', () => {
            mobileToggle.classList.toggle('active');
            navLinks.classList.toggle('active');
            // Prevent scrolling when menu is open
            if(navLinks.classList.contains('active')) {
                body.style.overflow = 'hidden';
            } else {
                body.style.overflow = 'auto';
            }
        });

        // Close menu on link click
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                mobileToggle.classList.remove('active');
                navLinks.classList.remove('active');
                body.style.overflow = 'auto';
            });
        });

        // 2. Header Scroll Effects
        const header = document.getElementById('header');
        const backToTop = document.getElementById('backToTop');
        const progressBar = document.getElementById('progressBar');

        window.addEventListener('scroll', () => {
            // Shrink Header
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
                backToTop.classList.add('visible');
            } else {
                header.classList.remove('scrolled');
                backToTop.classList.remove('visible');
            }

            // Progress Bar
            const winScroll = document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrolled = (winScroll / height) * 100;
            progressBar.style.width = scrolled + "%";
        });

        // 3. GSAP Animations
        gsap.from(".hero-content > *", {
            y: 30, opacity: 0, duration: 1, stagger: 0.2, ease: "power4.out"
        });

        gsap.from(".dashboard-mockup", {
            x: 50, opacity: 0, duration: 1.2, delay: 0.5, ease: "power2.out"
        });

        // Stagger Cards on Scroll
        const revealOnScroll = (selector) => {
            gsap.utils.toArray(selector).forEach(card => {
                gsap.from(card, {
                    scrollTrigger: {
                        trigger: card,
                        start: "top 90%",
                    },
                    y: 40, opacity: 0, duration: 0.8
                });
            });
        };

        revealOnScroll(".hiw-card");
        revealOnScroll(".reward-card");
        revealOnScroll(".method-card"); // <--- ADD THIS LINE HERE

        // 4. Counter Animation
        const animateCounters = () => {
            const counters = document.querySelectorAll('.counter');
            counters.forEach(counter => {
                const target = +counter.getAttribute('data-target');
                const updateCount = () => {
                    const count = +counter.innerText.replace(/[K,M,+]/g, '');
                    const inc = target / 100;
                    if (count < target) {
                        counter.innerText = Math.ceil(count + inc).toLocaleString();
                        setTimeout(updateCount, 20);
                    } else {
                        if(target >= 1000000) counter.innerText = (target/1000000) + "M+";
                        else if(target >= 1000) counter.innerText = (target/1000) + "K+";
                        else counter.innerText = target.toLocaleString();
                    }
                };
                updateCount();
            });
        };

        ScrollTrigger.create({
            trigger: ".stats-grid",
            start: "top 80%",
            onEnter: animateCounters,
            once: true
        });

        // 5. FAQ Accordion
        document.querySelectorAll('.faq-item').forEach(item => {
            item.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
                if(!isActive) item.classList.add('active');
            });
        });

        // 6. Testimonials Logic
        const testimonials = [
            { name: "Sarah J.", text: "Made ₦50,000 in my first week! The instant PayPal payouts are a game changer.", stars: "★★★★★" },
            { name: "Mike D.", text: "Finally a survey site that doesn't disqualify me 10 minutes in. Very professional.", stars: "★★★★☆" },
            { name: "Lena R.", text: "The interface is beautiful and works perfectly on my phone. Highly recommend!", stars: "★★★★★" }
        ];

        const slider = document.getElementById('testimonialSlider');
        let currentIdx = 0;

        function renderTestimonials() {
            testimonials.forEach((t, i) => {
                const card = document.createElement('div');
                card.className = `testimonial-card ${i === 0 ? 'active' : ''}`;
                card.innerHTML = `
                    <div style="background:white; padding:40px; border-radius:16px; box-shadow:var(--shadow-md); text-align:center; max-width:600px; margin:0 auto;">
                        <div style="color:#FFD700; margin-bottom:15px; font-size:1.2rem;">${t.stars}</div>
                        <p style="font-style:italic; font-size:1.2rem; color:var(--text-main)">"${t.text}"</p>
                        <h4 style="margin-top:20px; color:var(--primary-blue)">${t.name}</h4>
                    </div>
                `;
                slider.appendChild(card);
            });
        }

        function rotateTestimonials() {
            const cards = document.querySelectorAll('.testimonial-card');
            cards[currentIdx].classList.remove('active');
            currentIdx = (currentIdx + 1) % cards.length;
            cards[currentIdx].classList.add('active');
        }

        renderTestimonials();
        setInterval(rotateTestimonials, 5000);

        // 7. Back To Top
        backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
