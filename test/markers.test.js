/* eslint-env jest */

// Packet 2 acceptance: "Every value in the taxonomy maps to a marker; test
// asserts no gaps" and "unclassified has a defined fallback marker".
//
// These are real assertions on the pure function, not source greps. The gap
// test is the part that keeps earning its keep: the type list in
// utils/taxonomy.js is three placeholders, and when the real list arrives this
// fails for every type whose glyph was forgotten rather than rendering a blank
// pin nobody notices.

const React=require("react");
const {act,create}=require("react-test-renderer");

const {
  allTypePairs,
  CATEGORIES,
  TYPES,
  UNCLASSIFIED
}=require("../utils/taxonomy");

const {INK}=require("../utils/tokens");

const {
  MARKER_STATES,
  glyphNames,
  glyphPrimitives,
  markerForBusiness,
  markerForClub,
  markerForProperty
}=require("../utils/markers");

const PlaceMarker=require("../components/PlaceMarker").default;

const pairs=allTypePairs();

function business(category,type,extra){
  return {category,business_type:type,claimed:true,...extra};
}

describe("every classification maps to a marker",()=>{
  it("has classifications to test",()=>{
    // Guards against the suite passing because allTypePairs() returned nothing.
    expect(pairs.length).toBe(CATEGORIES.length+TYPES.length);
  });

  it.each(pairs.map((pair)=>[`${pair.category}/${pair.type}`,pair]))(
    "%s",
    (_name,pair)=>{
      const marker=markerForBusiness(business(pair.category,pair.type));

      expect(typeof marker.glyph).toBe("string");
      expect(marker.glyph.length).toBeGreaterThan(0);

      // The glyph name resolving is not enough -- it has to be drawable.
      const primitives=glyphPrimitives(marker.glyph);
      expect(Array.isArray(primitives)).toBe(true);
      expect(primitives.length).toBeGreaterThan(0);

      for(const primitive of primitives){
        expect(Boolean(primitive.path)||Boolean(primitive.circle)).toBe(true);
      }
    }
  );

  it("gives the unclassified category its own fallback marker",()=>{
    const marker=markerForBusiness(business(UNCLASSIFIED,UNCLASSIFIED));

    expect(glyphPrimitives(marker.glyph)).not.toBeNull();
    expect(marker.label).toContain("Unclassified");
  });

  it("falls back to the category glyph when only the type is unclassified",()=>{
    const food=CATEGORIES.find((category)=>category.key==="food_and_drink");
    const marker=markerForBusiness(business(food.key,UNCLASSIFIED));

    expect(marker.glyph).toBe(food.glyph);
    // The category is still known, so the pin says so rather than "not yet
    // classified" -- that is the whole reason the fallback is per category.
    expect(marker.label).toContain(food.label);
  });

  it("survives a business with no classification at all",()=>{
    for(const input of [undefined,null,{},{category:null,business_type:null}]){
      const marker=markerForBusiness(input);
      expect(glyphPrimitives(marker.glyph)).not.toBeNull();
      expect(marker.label.length).toBeGreaterThan(0);
    }
  });

  it("leaves no glyph unreachable",()=>{
    const reached=new Set([
      ...pairs.map((pair)=>markerForBusiness(business(pair.category,pair.type)).glyph),
      markerForProperty().glyph,
      markerForClub().glyph
    ]);

    // An orphan glyph is dead weight, and usually the sign that a type was
    // renamed and its drawing left behind.
    expect([...glyphNames()].sort()).toEqual([...reached].sort());
  });
});

describe("colour carries state, never type",()=>{
  it("gives every business type the same ink",()=>{
    const fills=new Set(
      pairs.map((pair)=>markerForBusiness(business(pair.category,pair.type)).fill)
    );

    // The moment this set has two members, a business type has started
    // choosing a colour and the three-ink rule is broken.
    expect([...fills]).toEqual([INK.blue]);
  });

  it("uses one ink per state and no fourth colour",()=>{
    expect(Object.keys(MARKER_STATES)).toHaveLength(3);

    const inks=new Set([
      markerForBusiness(business("food_and_drink","pub")).fill,
      markerForClub().fill
    ]);

    for(const ink of inks){
      expect([INK.blue,INK.pink,INK.yellow]).toContain(ink);
    }
  });

  it("gives a property the same exists-ink as a business",()=>{
    // A place is a place: business, property and park are all blue.
    expect(markerForProperty().fill).toBe(markerForBusiness(business("shopping","unclassified")).fill);
  });

  it("puts a club on the scheduled ink",()=>{
    expect(markerForClub().fill).toBe(INK.pink);
    expect(markerForClub().state).toBe(MARKER_STATES.SCHEDULED);
  });
});

describe("accessibility floor",()=>{
  const markers=[
    ...pairs.map((pair)=>markerForBusiness(business(pair.category,pair.type))),
    ...pairs.map((pair)=>markerForBusiness(business(pair.category,pair.type,{claimed:false}))),
    markerForProperty(),
    markerForClub()
  ];

  it("never puts the light glyph on pink or yellow",()=>{
    // design-system.md: white is only legible on ink-blue and ink. This is the
    // check that stops a glyph disappearing into a yellow pin.
    for(const marker of markers){
      if(marker.glyphInk===INK.card){
        expect([INK.blue,INK.ink]).toContain(marker.fill);
      }
    }
  });

  it("never carries state by colour alone",()=>{
    for(const marker of markers){
      expect(typeof marker.label).toBe("string");
      expect(marker.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("says nobody manages an unclaimed place, and does not use a fourth ink for it",()=>{
    const unclaimed=markerForBusiness(business("food_and_drink","bar",{claimed:false}));

    expect(unclaimed.fill).toBe(INK.card);
    expect(unclaimed.borderStyle).toBe("dashed");
    expect(unclaimed.label).toContain("Nobody manages this yet");
    // Still a place that exists -- the dash says unclaimed, not the state.
    expect(unclaimed.state).toBe(MARKER_STATES.EXISTS);
  });

  it("treats a business with no claimed column as unclaimed",()=>{
    // businesses.claimed defaults to false. A query that forgets to select it
    // must not invent a manager for the place.
    expect(markerForBusiness({category:"food_and_drink",business_type:"pub"}).borderStyle).toBe("dashed");
  });
});

describe("the pin renders",()=>{
  // react-native-svg resolves a colour to an opaque ARGB integer before it
  // reaches the host component, so the hex never appears in the tree.
  function argb(hex){
    return (0xff000000+parseInt(hex.slice(1),16))>>>0;
  }

  function nodes(node,type,found=[]){
    if(!node || typeof node!=="object") return found;
    if(Array.isArray(node)){
      for(const child of node) nodes(child,type,found);
      return found;
    }
    if(node.type===type) found.push(node);
    nodes(node.children,type,found);
    return found;
  }

  async function render(marker){
    let tree;
    await act(async()=>{
      tree=create(React.createElement(PlaceMarker,{marker}));
    });
    return tree;
  }

  it("draws the circle and every glyph primitive",async()=>{
    const marker=markerForBusiness(business("food_and_drink","pub"));
    const primitives=glyphPrimitives(marker.glyph);
    const tree=await render(marker);
    const json=tree.toJSON();

    const circle=nodes(json,"RNSVGCircle")[0];
    expect(circle.props.fill.payload).toBe(argb(marker.fill));
    expect(circle.props.stroke.payload).toBe(argb(marker.border));

    const paths=nodes(json,"RNSVGPath");
    expect(paths.map((node)=>node.props.d)).toEqual(
      primitives.filter((item)=>item.path).map((item)=>item.path)
    );
    for(const path of paths){
      expect(path.props.stroke.payload).toBe(argb(marker.glyphInk));
    }

    // The glyph sits in its own 16-unit space and is translated to the centre
    // of the 34-unit pin. If that translate is ever dropped the glyph draws in
    // the top-left corner and still renders, so nothing else would catch it.
    // The last two components of the affine matrix are the translate.
    const glyphGroup=nodes(json,"RNSVGGroup").find((node)=>node.props.matrix);
    expect(glyphGroup.props.matrix.slice(4)).toEqual([9,9]);

    await act(async()=>{tree.unmount();});
  });

  it("dashes the border of an unclaimed place and solidifies a claimed one",async()=>{
    const unclaimed=await render(markerForBusiness(business("food_and_drink","bar",{claimed:false})));
    expect(nodes(unclaimed.toJSON(),"RNSVGCircle")[0].props.strokeDasharray).toEqual([3.4,2.6]);

    const claimed=await render(markerForBusiness(business("food_and_drink","bar")));
    expect(nodes(claimed.toJSON(),"RNSVGCircle")[0].props.strokeDasharray).toBeFalsy();

    await act(async()=>{unclaimed.unmount();claimed.unmount();});
  });

  it("carries the marker sentence to screen readers",async()=>{
    const marker=markerForBusiness(business("food_and_drink","pub"));
    const tree=await render(marker);

    expect(tree.toJSON().props.accessibilityLabel).toBe(marker.label);
    expect(marker.label).toBe("Pub. A place that exists.");

    await act(async()=>{tree.unmount();});
  });

  it("renders nothing rather than throwing when handed no marker",async()=>{
    let tree;
    await act(async()=>{
      tree=create(React.createElement(PlaceMarker,{marker:null}));
    });

    expect(tree.toJSON()).toBeNull();

    await act(async()=>{tree.unmount();});
  });
});
