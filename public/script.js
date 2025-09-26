// Wait for the entire HTML document to be loaded before running the script
document.addEventListener("DOMContentLoaded", () => {
  // Get references to all the HTML elements we need to interact with
  const form = document.getElementById("video-form");
  const submitBtn = document.getElementById("submit-btn");
  const statusArea = document.getElementById("status-area");
  const statusMessage = document.getElementById("status-message");
  const downloadLink = document.getElementById("download-link");

  // Add an event listener to the form for when the user clicks the submit button
  form.addEventListener("submit", async (event) => {
    console.log("Form submitted! Button was clicked.");
    event.preventDefault();

    // --- 1. Get User Input (Format is now hardcoded) ---
    const url = document.getElementById("video-url").value;
    const startTime = document.getElementById("start-time").value;
    const endTime = document.getElementById("end-time").value;

    // --- 2. Update UI to Show Loading State ---
    statusArea.classList.remove("hidden");
    statusMessage.textContent =
      "Processing... Please wait. This might take a minute.";
    downloadLink.classList.add("hidden");
    submitBtn.disabled = true;
    submitBtn.textContent = "Working...";

    try {
      // --- 3. Send Data to the Backend ---
      const response = await fetch("/process-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, startTime, endTime, format: "mp3" }), // Always request mp3
      });

      const data = await response.json();

      // --- 4. Handle the Server's Response ---
      if (data.success) {
        statusMessage.textContent = "Success! Your clip is ready.";
        downloadLink.href = data.downloadUrl;
        downloadLink.classList.remove("hidden");
      } else {
        statusMessage.textContent = `Error: ${data.message}`;
      }
    } catch (error) {
      statusMessage.textContent = "A network error occurred. Please try again.";
      console.error("Fetch error:", error);
    } finally {
      // --- 5. Reset UI State ---
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Voice Clip";
    }
  });
});
