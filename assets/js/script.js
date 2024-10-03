'use strict';

// Element toggle function
const toggleElement = (elem) => elem.classList.toggle("active");

// Sidebar variables
const sidebar = document.querySelector("[data-sidebar]");
const sidebarBtn = document.querySelector("[data-sidebar-btn]");

// Sidebar toggle functionality for mobile
sidebarBtn.addEventListener("click", () => toggleElement(sidebar));

// Testimonials variables
const testimonialsItems = document.querySelectorAll("[data-testimonials-item]");
const modalContainer = document.querySelector("[data-modal-container]");
const modalCloseBtn = document.querySelector("[data-modal-close-btn]");
const overlay = document.querySelector("[data-overlay]");
const modalImg = document.querySelector("[data-modal-img]");
const modalTitle = document.querySelector("[data-modal-title]");
const modalText = document.querySelector("[data-modal-text]");

// Modal toggle function
const toggleTestimonialsModal = () => {
  toggleElement(modalContainer);
  toggleElement(overlay);
};

// Add click event to all modal items
testimonialsItems.forEach(item => {
  item.addEventListener("click", () => {
    const avatar = item.querySelector("[data-testimonials-avatar]");
    modalImg.src = avatar.src;
    modalImg.alt = avatar.alt;
    modalTitle.innerHTML = item.querySelector("[data-testimonials-title]").innerHTML;
    modalText.innerHTML = item.querySelector("[data-testimonials-text]").innerHTML;

    toggleTestimonialsModal();
  });
});

// Add click event to modal close button and overlay
modalCloseBtn.addEventListener("click", toggleTestimonialsModal);
overlay.addEventListener("click", toggleTestimonialsModal);

// Custom select variables
const select = document.querySelector("[data-select]");
const selectItems = document.querySelectorAll("[data-select-item]");
const selectValue = document.querySelector("[data-select-value]");
const filterBtns = document.querySelectorAll("[data-filter-btn]");

select.addEventListener("click", () => toggleElement(select));

// Add event in all select items
selectItems.forEach(item => {
  item.addEventListener("click", () => {
    const selectedValue = item.innerText.toLowerCase();
    selectValue.innerText = item.innerText;
    toggleElement(select);
    filterItems(selectedValue);
  });
});

// Filter variables
const filterItemsList = document.querySelectorAll("[data-filter-item]");

// Filter function
const filterItems = (selectedValue) => {
  filterItemsList.forEach(item => {
    const category = item.dataset.category;
    if (selectedValue === "all" || selectedValue === category) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
};

// Add event to all filter button items for large screens
let lastClickedBtn = filterBtns[0];

filterBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const selectedValue = btn.innerText.toLowerCase();
    selectValue.innerText = btn.innerText;
    filterItems(selectedValue);

    // Toggle active state for buttons
    lastClickedBtn.classList.remove("active");
    btn.classList.add("active");
    lastClickedBtn = btn;
  });
});

// Contact form variables
const form = document.querySelector("[data-form]");
const formInputs = document.querySelectorAll("[data-form-input]");
const formBtn = document.querySelector("[data-form-btn]");

// Add event to all form input fields
formInputs.forEach(input => {
  input.addEventListener("input", () => {
    // Check form validation
    formBtn.disabled = !form.checkValidity();
  });
});

// Page navigation variables
const navigationLinks = document.querySelectorAll("[data-nav-link]");
const pages = document.querySelectorAll("[data-page]");

// Add event to all nav links for page navigation
navigationLinks.forEach(link => {
  link.addEventListener("click", () => {
    const targetPage = link.dataset.navLink;

    pages.forEach(page => {
      const isActive = page.dataset.page === targetPage;
      page.classList.toggle("active", isActive);
    });

    navigationLinks.forEach(navLink => {
      navLink.classList.toggle("active", navLink === link);
    });

    window.scrollTo(0, 0); // Scroll to top
  });
});
