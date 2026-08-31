import Cocoa
import Foundation

func getSelectedText() -> String? {
    // 1. Get the frontmost application (the app the user was interacting with)
    guard let frontmostApp = NSWorkspace.shared.frontmostApplication else {
        return getSelectedTextSystemWide()
    }
    
    // Create accessibility element for the active application
    let appElement = AXUIElementCreateApplication(frontmostApp.processIdentifier)
    
    var focusedElementRef: AnyObject?
    let result = AXUIElementCopyAttributeValue(appElement, kAXFocusedUIElementAttribute as CFString, &focusedElementRef)
    
    guard result == .success, let focusedElement = focusedElementRef else {
        return getSelectedTextSystemWide()
    }
    
    var selectedTextRef: AnyObject?
    let textResult = AXUIElementCopyAttributeValue(focusedElement as! AXUIElement, kAXSelectedTextAttribute as CFString, &selectedTextRef)
    
    if textResult == .success, let selectedText = selectedTextRef as? String {
        return selectedText.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    return getSelectedTextSystemWide()
}

func getSelectedTextSystemWide() -> String? {
    let systemWideElement = AXUIElementCreateSystemWide()
    
    var focusedElementRef: AnyObject?
    let result = AXUIElementCopyAttributeValue(systemWideElement, kAXFocusedUIElementAttribute as CFString, &focusedElementRef)
    
    guard result == .success, let focusedElement = focusedElementRef else {
        return nil
    }
    
    var selectedTextRef: AnyObject?
    let textResult = AXUIElementCopyAttributeValue(focusedElement as! AXUIElement, kAXSelectedTextAttribute as CFString, &selectedTextRef)
    
    if textResult == .success, let selectedText = selectedTextRef as? String {
        return selectedText.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    return nil
}

// Print currently selected text if any
if let text = getSelectedText(), !text.isEmpty {
    print(text)
    fflush(stdout)
}
