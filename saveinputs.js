$(function() {
  // Load saved values from storage and fill in form fields
  chrome.storage.local.get(["urlInputValue", "textInputValue"], function(data) {
    if (data.urlInputValue) {
      $("#urlInput").val(data.urlInputValue);
    }
    if (data.textInputValue) {
      $("#output").html(data.textInputValue);
    }
  });

  // Save values to storage when inputs change
  $("#urlInput").on("input", function() {
    const urlInputValue = $("#urlInput").val();
    chrome.storage.local.set({ urlInputValue });
  });

  $("#output").on("input", function() {
    const textInputValue = $("#output").html();
    chrome.storage.local.set({ textInputValue });
  });

  // Extract text when extractButton is clicked
  $("#extractButton").click(function() {
    const urlInputValue = $("#urlInput").val();
    const textInputValue = $("#output").html();
    chrome.storage.local.set({ urlInputValue, textInputValue });
    chrome.runtime.sendMessage({ type: "extract", url: urlInputValue, text: textInputValue });
  });
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === "extract") {
    const url = request.url;
    const text = request.text;
    extractText(url, text);
  }
});
