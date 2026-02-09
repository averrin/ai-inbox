from playwright.sync_api import sync_playwright

def test_debug():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Capture console logs
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
        page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

        try:
            page.goto("http://localhost:8081", timeout=60000)
            page.wait_for_timeout(5000)
            page.screenshot(path="/home/jules/verification/debug_console.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    test_debug()
