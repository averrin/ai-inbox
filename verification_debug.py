from playwright.sync_api import sync_playwright

def test_debug():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("http://localhost:8081", timeout=60000)
            page.wait_for_timeout(5000)
            page.screenshot(path="/home/jules/verification/debug_initial.png")
            print("Screenshot taken.")

            # Print page title and content for debug
            print(f"Title: {page.title()}")
            # print(f"Content: {page.content()}") # Too verbose usually

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/debug_error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    test_debug()
