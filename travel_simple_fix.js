// Enhanced travel section toggle - Desktop/Mobile optimized
document.addEventListener('DOMContentLoaded', function() {
  // Prevent multiple initializations
  if (window.travelSectionsInitialized) {
    console.log('� Travel sections already initialized');
    return;
  }
  window.travelSectionsInitialized = true;
  
  console.log('�🚀 Enhanced travel script loaded');

  // Find all travel section headers
  const headers = document.querySelectorAll('.travel-section h2');
  console.log('📋 Found headers:', headers.length);

  if (headers.length === 0) {
    console.warn('⚠️ No travel section headers found!');
    return;
  }

  // Function to check if we're in mobile view
  function isMobileView() {
    return window.innerWidth <= 768;
  }

  headers.forEach(function(header, index) {
    console.log(`✅ Header ${index + 1}:`, header.textContent.trim());

    // Remove any existing listeners by cloning the element
    const newHeader = header.cloneNode(true);
    header.parentNode.replaceChild(newHeader, header);

    newHeader.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('🎯 Clicked header:', newHeader.textContent.trim());

      // Find the parent section
      const section = newHeader.closest('.travel-section');
      console.log('📦 Section found:', !!section);

      if (section) {
        const isExpanded = section.classList.contains('expanded');

        if (isMobileView()) {
          // Mobile behavior: Toggle current section (like FAQ)
          if (isExpanded) {
            console.log('📱 Mobile: Closing section');
            section.classList.remove('expanded');
          } else {
            console.log('📱 Mobile: Opening section');
            section.classList.add('expanded');
          }
        } else {
          // Desktop behavior: Toggle current section (classic accordion)
          if (isExpanded) {
            console.log('🖥️ Desktop: Closing section');
            section.classList.remove('expanded');
          } else {
            console.log('🖥️ Desktop: Opening section');
            section.classList.add('expanded');
          }
        }
      }
    });

    // Add visual feedback
    newHeader.style.cursor = 'pointer';
    newHeader.style.transition = 'background-color 0.2s';
    newHeader.addEventListener('mouseenter', function() {
      this.style.backgroundColor = 'rgba(255,255,255,0.1)';
    });
    newHeader.addEventListener('mouseleave', function() {
      this.style.backgroundColor = '';
    });
  });

  // Handle window resize to update behavior
  window.addEventListener('resize', function() {
    console.log('📏 Window resized, mobile view:', isMobileView());
  });

  console.log('🎨 Initial mobile view:', isMobileView());
  console.log('✅ Travel sections initialized successfully');
});
