from playwright.sync_api import sync_playwright

def test_dump_tab():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Navigate to the app
            page.goto("http://localhost:8081")

            # Wait for the app to load
            # Look for a known element, e.g., "Schedule" tab or similar
            # Based on BottomTabNavigator.tsx, the initial route is "Schedule"
            # And tab labels are hidden or small. Icons are used.
            # But "Dump" tab has an icon `journal-outline`.
            # Tab labels are "Schedule", "Note", "Tasks", "Dump", "Reminders", "Settings".

            # Wait for any tab to be visible
            page.wait_for_selector('text="Schedule"', timeout=60000)

            # Check if "Dump" tab is present
            dump_tab = page.get_by_role("link", name="Dump")
            # If react-navigation web implementation uses links or buttons
            if dump_tab.count() == 0:
                dump_tab = page.get_by_text("Dump")

            if dump_tab.count() > 0:
                print("Dump tab found!")
                dump_tab.click()

                # Wait for the editor to load
                # The editor has a placeholder "Start dumping your thoughts..."
                # However, since it is inside an iframe (webview), we might need to look inside frame
                # Or just verify the container is there.

                # Take screenshot of the Dump tab
                page.wait_for_timeout(2000) # Give it some time to render
                page.screenshot(path="/home/jules/verification/dump_tab.png")
            else:
                print("Dump tab NOT found!")
                page.screenshot(path="/home/jules/verification/dump_tab_missing.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    test_dump_tab()
