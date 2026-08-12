/* eslint-env jest */

// Does a confirmation actually appear on the web build?
//
// react-native-web's Alert is literally `static alert() {}` -- an empty
// function (node_modules/react-native-web/dist/exports/Alert/index.js). So every
// Alert.alert in this app would be a button that looks like it works and does
// nothing, on web, in all 46 places it is called.
//
// It is not, because FeedbackProvider replaces Alert.alert on web with one that
// renders a real dialog. That was already there and it was never covered by a
// test, so "does confirming work on web" was answerable only by opening the app
// and pressing something. This is the answer written down.

const React=require("react");
const {act,create}=require("react-test-renderer");
const {Platform,Alert}=require("react-native");
const {textOf,labelsOf}=require("./fixture");

const originalOS=Platform.OS;
const originalAlert=Alert.alert;

afterEach(()=>{
  Platform.OS=originalOS;
  Alert.alert=originalAlert;
});

function renderProvider(){
  // The provider installs the replacement on mount, so the platform has to be
  // web before it renders.
  Platform.OS="web";
  const {FeedbackProvider}=require("../context/FeedbackContext");

  let tree;
  act(()=>{
    tree=create(React.createElement(FeedbackProvider,null,
      React.createElement(require("react-native").View)));
  });
  return tree;
}

it("react-native-web's own Alert really is a no-op, which is why this matters",()=>{
  const webAlert=require("react-native-web/dist/exports/Alert").default;
  // No arguments, no return, no side effect. If this ever stops being true the
  // replacement below can go.
  expect(webAlert.alert.length).toBe(0);
  expect(webAlert.alert("Title","Message",[{text:"OK"}])).toBeUndefined();
});

it("shows a real dialog on web, with every button on it",()=>{
  const tree=renderProvider();

  act(()=>{
    Alert.alert("Log out?","You will need to sign in again.",[
      {text:"Cancel",style:"cancel"},
      {text:"Log out",style:"destructive",onPress:()=>{}}
    ]);
  });

  const text=textOf(tree.toJSON());
  console.log("WEB DIALOG >>>",text);

  expect(text).toContain("Log out?");
  expect(text).toContain("You will need to sign in again.");
  expect(text).toContain("Cancel");
  expect(text).toContain("Log out");

  act(()=>{tree.unmount();});
});

it("runs the button that was pressed, and closes",()=>{
  const tree=renderProvider();
  const chose=jest.fn();

  act(()=>{
    Alert.alert("Send a password reset link?","We will email you a link.",[
      {text:"Cancel",style:"cancel"},
      {text:"Send link",onPress:chose}
    ]);
  });

  const button=tree.root.findAll(
    (node)=>node.props?.accessibilityLabel==="Send link"
      && typeof node.props?.onPress==="function",
    {deep:true}
  )[0];

  expect(button).toBeTruthy();
  act(()=>{button.props.onPress();});

  expect(chose).toHaveBeenCalled();
  // And the dialog is gone rather than sitting there after being answered.
  expect(textOf(tree.toJSON())).not.toContain("Send a password reset link?");

  act(()=>{tree.unmount();});
});

it("gives a bare Alert.alert an OK button rather than a dialog you cannot leave",()=>{
  const tree=renderProvider();

  act(()=>{Alert.alert("Saved");});

  const labels=labelsOf(tree.toJSON());
  const text=textOf(tree.toJSON());
  console.log("BARE ALERT >>>",text,"|",labels.join(" "));

  expect(text).toContain("Saved");
  expect(text).toContain("OK");
  // And it is announced, not just drawn.
  expect(labels).toContain("OK");

  act(()=>{tree.unmount();});
});
