// Language switching functionality
class LanguageManager {
  constructor() {
    console.log('LanguageManager constructor called'); // Debug log
    this.currentLanguage = 'de'; // Always start with German
    this.translations = {};
    this.init();
  }

  async init() {
    await this.loadTranslations();
    console.log('Translations loaded, setting up listeners'); // Debug log
    
    // Wait a bit for DOM to be fully ready
    setTimeout(() => {
      this.setupEventListeners();
    }, 100);
    
    this.setupScrollListener();
    this.applyTranslations();
    
    // Set initial button visibility
    this.handleScroll();
  }

  async loadTranslations() {
    try {
      const response = await fetch('./translations_backup.json');
      this.translations = await response.json();
    } catch (error) {
      console.error('Failed to load translations:', error);
    }
  }

  setupEventListeners() {
    // Try multiple possible button IDs/classes for different pages
    const buttonSelectors = [
      '#languageToggle', // travel.html
      '#bannerLanguageToggle', // index.html banner
      '.home-language-toggle', // index.html home button
      '.banner-language-toggle', // any banner button
      '.language-toggle' // fallback
    ];
    
    let button = null;
    for (const selector of buttonSelectors) {
      button = document.querySelector(selector);
      if (button) {
        console.log(`Found language button with selector: ${selector}`);
        break;
      }
    }
    
    if (button) {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent delegation from also firing
        console.log('Language button clicked!');
        this.toggleLanguage();
      });
    } else {
      console.error('No language button found!');
    }
    
    // Event delegation as fallback for dynamically moved buttons
    document.addEventListener('click', (e) => {
      if (e.target.matches('.language-toggle, #languageToggle, #bannerLanguageToggle')) {
        // Only trigger if no direct listener was set up
        if (!button || e.target !== button) {
          e.preventDefault();
          console.log('Language button clicked via delegation!');
          this.toggleLanguage();
        }
      }
    });
  }

  setupScrollListener() {
    let lastScrollTime = 0;
    const scrollThrottle = 100; // Limit scroll event handling to every 100ms

    window.addEventListener('scroll', () => {
      const now = Date.now();
      if (now - lastScrollTime > scrollThrottle) {
        lastScrollTime = now;
        this.handleScroll();
      }
    });
  }

  handleScroll() {
    const homeButton = document.querySelector('.home-language-toggle');
    const bannerButton = document.querySelector('.banner-language-toggle');
    
    if (!homeButton || !bannerButton) return;
    
    // Get the banner section
    const eventSection = document.getElementById('event');
    if (!eventSection) return;
    
    const eventSectionTop = eventSection.offsetTop;
    const scrollY = window.scrollY;
    const threshold = 100; // Buffer zone
    
    // Show home button when at top, banner button when in event section and below
    if (scrollY < eventSectionTop - threshold) {
      // At the top - show home button, hide banner button
      homeButton.style.display = 'block';
      bannerButton.style.display = 'none';
    } else {
      // In event section and below - hide home button, show banner button
      homeButton.style.display = 'none';
      bannerButton.style.display = 'block';
    }
    
    // Handle background color change for better visibility
    if (scrollY > 50) {
      homeButton.classList.add('black-bg');
    } else {
      homeButton.classList.remove('black-bg');
    }
  }

  // Get current translation for a key
  getTranslation(key) {
    const langData = this.translations[this.currentLanguage];
    return langData ? langData[key] : key;
  }

  // Get translation with placeholder replacement
  getTranslationWithPlaceholder(key, placeholders = {}) {
    let translation = this.getTranslation(key);
    
    // Replace placeholders like {name} with actual values
    Object.keys(placeholders).forEach(placeholder => {
      const regex = new RegExp(`{${placeholder}}`, 'g');
      translation = translation.replace(regex, placeholders[placeholder]);
    });
    
    return translation;
  }

  toggleLanguage() {
    this.currentLanguage = this.currentLanguage === 'de' ? 'en' : 'de';
    // Removed localStorage persistence - always reset to German on page load
    this.applyTranslations();
  }

  applyTranslations() {
    const translations = this.translations[this.currentLanguage];
    if (!translations) return;

    document.querySelectorAll('[data-translate]').forEach(element => {
      const key = element.getAttribute('data-translate');
      if (translations[key]) {
        if (element.tagName === 'INPUT' && (element.type === 'password' || element.type === 'text' || element.type === 'email')) {
          element.placeholder = translations[key];
        } else if (element.hasAttribute('data-translate-html')) {
          // For HTML content - use innerHTML instead of textContent
          element.innerHTML = translations[key];
        } else {
          element.textContent = translations[key];
        }
      }
    });

    document.querySelectorAll('[data-translate-attr]').forEach(element => {
      const key = element.getAttribute('data-translate-attr');
      const attr = element.getAttribute('data-attr') || 'aria-label';
      if (translations[key]) {
        element.setAttribute(attr, translations[key]);
      }
    });
  }
}

// Initialize language manager when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.languageManager = new LanguageManager();
  });
} else {
  window.languageManager = new LanguageManager();
}
