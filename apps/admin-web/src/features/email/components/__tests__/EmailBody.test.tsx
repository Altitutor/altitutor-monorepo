import { fireEvent, render, screen } from "@testing-library/react";
import { EmailBody } from "../EmailBodyEditor";

it("shows the full message height rather than capping it at an internally scrolling card", () => {
  render(<EmailBody html="<p>Long email</p>" text="Long email" />);
  const frame = screen.getByTitle("Email content") as HTMLIFrameElement;
  Object.defineProperty(frame.contentDocument!.body, "scrollHeight", {
    value: 6500,
    configurable: true,
  });
  fireEvent.load(frame);
  expect(frame).toHaveStyle({ height: "6500px" });
});

it("keeps Outlook quoted history collapsed until explicitly expanded", async () => {
  render(
    <EmailBody
      html={
        '<p>Latest note</p><div id="divRplyFwdMsg">From: previous sender</div><p>Old email body</p>'
      }
      text="Latest note"
    />,
  );
  await screen.findByRole("button", { name: "Show quoted history" });
  expect(screen.getByTitle("Email content").getAttribute("srcdoc")).toContain(
    "Latest note",
  );
  expect(
    screen.getByTitle("Email content").getAttribute("srcdoc"),
  ).not.toContain("Old email body");
  expect(screen.queryByTitle("Quoted email history")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show quoted history" }));
  expect(
    screen.getByTitle("Quoted email history").getAttribute("srcdoc"),
  ).toContain("Old email body");
});
it("does not forward shortcuts typed into fields inside received HTML", () => {
  const forwarded = jest.fn();
  render(
    <div onKeyDown={forwarded}>
      <EmailBody html='<input aria-label="Embedded field" />' text="" />
    </div>,
  );
  const frame = screen.getByTitle("Email content") as HTMLIFrameElement;
  frame.contentDocument!.body.innerHTML =
    '<input aria-label="Embedded field" />';
  fireEvent.load(frame);
  fireEvent.keyDown(frame.contentDocument!.querySelector("input")!, {
    key: "Backspace",
  });
  expect(forwarded).not.toHaveBeenCalled();
  fireEvent.keyDown(frame.contentDocument!.body, { key: "r" });
  expect(forwarded).toHaveBeenCalledTimes(1);
});

it('forwards every global navigation letter and Option modifiers from the HTML reader',()=>{
 const keys:string[]=[];
 render(<div onKeyDown={event=>keys.push(`${event.key}:${event.altKey}`)}><EmailBody html="<p>Reader</p>" text=""/></div>);
 const frame=screen.getByTitle('Email content') as HTMLIFrameElement;
 fireEvent.load(frame);
 for(const key of ['g','d','e','h','b'])fireEvent.keyDown(frame.contentDocument!.body,{key});
 fireEvent.keyDown(frame.contentDocument!.body,{key:'ƒ',code:'KeyF',altKey:true});
 expect(keys).toEqual(['g:false','d:false','e:false','h:false','b:false','ƒ:true']);
});
