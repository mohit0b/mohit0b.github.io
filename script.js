document.addEventListener("DOMContentLoaded", () => {
  const detailTitle = document.getElementById("detail-title");
  const detailDescription = document.getElementById("detail-description");
  const defaultTitle = detailTitle.textContent;
  const defaultDescription = detailDescription.textContent;

  const nodes = document.querySelectorAll(".flow-node");

  nodes.forEach((node) => {
    const title = node.dataset.title;
    const description = node.dataset.description;

    const activate = () => {
      detailTitle.textContent = title;
      detailDescription.textContent = description;
      detailDescription.parentElement.classList.add("panel-active");
    };

    const reset = () => {
      detailTitle.textContent = defaultTitle;
      detailDescription.textContent = defaultDescription;
      detailDescription.parentElement.classList.remove("panel-active");
    };

    node.addEventListener("mouseenter", activate);
    node.addEventListener("focus", activate);
    node.addEventListener("mouseleave", reset);
    node.addEventListener("blur", reset);
    node.addEventListener("click", activate);
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
  });

  const scenarioSteps = Array.from(document.querySelectorAll(".scenario-step"));
  const progressFill = document.querySelector(".scenario-progress-fill");
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (scenarioSteps.length > 0 && progressFill) {
    let currentIndex = 0;
    let intervalId;

    const setStep = (index) => {
      currentIndex = index;
      scenarioSteps.forEach((step, i) => {
        step.classList.toggle("active", i === index);
      });

      const width = ((index + 1) / scenarioSteps.length) * 100;
      progressFill.style.width = `${width}%`;
    };

    const advanceStep = () => {
      const nextIndex = (currentIndex + 1) % scenarioSteps.length;
      setStep(nextIndex);
    };

    const startLoop = () => {
      if (prefersReducedMotion) return;
      clearInterval(intervalId);
      intervalId = setInterval(advanceStep, 4000);
    };

    scenarioSteps.forEach((step, index) => {
      step.addEventListener("mouseenter", () => {
        setStep(index);
        startLoop();
      });

      step.addEventListener("focus", () => {
        setStep(index);
        startLoop();
      });
    });

    setStep(0);
    startLoop();
  }
});
