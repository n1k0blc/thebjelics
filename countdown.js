(function(){
  const targetDate = new Date('2026-03-11T00:00:00').getTime();

  function pad2(n){ return String(n).padStart(2,'0'); }

  function update(){
    const daysEl    = document.getElementById('days');
    const hoursEl   = document.getElementById('hours');
    const minsEl    = document.getElementById('minutes');
    const secsEl    = document.getElementById('seconds');

    // If markup isn't present (e.g., on other pages/sections), do nothing
    if(!daysEl || !hoursEl || !minsEl || !secsEl) return;

    const now = Date.now();
    let diff = targetDate - now;

    if (diff < 0) diff = 0; // clamp when date has passed

    const days = Math.floor(diff / (1000*60*60*24));
    const hours = Math.floor((diff % (1000*60*60*24)) / (1000*60*60));
    const minutes = Math.floor((diff % (1000*60*60)) / (1000*60));
    const seconds = Math.floor((diff % (1000*60)) / 1000);

    daysEl.textContent = days;
    hoursEl.textContent = pad2(hours);
    minsEl.textContent = pad2(minutes);
    secsEl.textContent = pad2(seconds);
  }

  function start(){
    update();
    setInterval(update, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();