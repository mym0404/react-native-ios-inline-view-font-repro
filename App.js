/**
 * @flow
 * @format
 */

import type {TextStyle} from 'react-native';

import * as React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

const INLINE_SIZE = 18;
const HELVETICA = 'Helvetica';
const TIMES_NEW_ROMAN = 'TimesNewRomanPSMT';
const LARGE_FONT_SIZE = 32;
const MEDIUM_FONT_SIZE = 24;
const DEFAULT_FONT_SIZE = 20;
const SAMPLES = [
  {
    name: 'Helvetica 12 (control)',
    style: {fontFamily: HELVETICA, fontSize: 12},
  },
  {name: 'System 20', style: {fontSize: DEFAULT_FONT_SIZE}},
  {
    name: 'Helvetica 32',
    style: {fontFamily: HELVETICA, fontSize: LARGE_FONT_SIZE},
  },
  {
    name: 'Times New Roman 32',
    style: {fontFamily: TIMES_NEW_ROMAN, fontSize: LARGE_FONT_SIZE},
  },
  {
    name: 'Courier bold 24',
    style: {
      fontFamily: 'Courier',
      fontSize: MEDIUM_FONT_SIZE,
      fontWeight: 'bold',
    },
  },
  {
    name: 'Helvetica 32 / lineHeight 48',
    style: {fontFamily: HELVETICA, fontSize: LARGE_FONT_SIZE, lineHeight: 48},
  },
  {
    name: 'Nested Times New Roman 32',
    style: {fontFamily: TIMES_NEW_ROMAN, fontSize: LARGE_FONT_SIZE},
    isNested: true,
  },
  {
    name: 'Tall View / Helvetica 20',
    style: {fontFamily: HELVETICA, fontSize: DEFAULT_FONT_SIZE},
    height: 48,
  },
  {
    name: 'Wrapped / Helvetica 24',
    style: {fontFamily: HELVETICA, fontSize: MEDIUM_FONT_SIZE},
    isWrapped: true,
  },
  {
    name: 'Scaled / Helvetica 20',
    style: {fontFamily: HELVETICA, fontSize: DEFAULT_FONT_SIZE},
    isScaled: true,
  },
];

function Sample({
  name,
  style,
  isNested = false,
  isWrapped = false,
  isScaled = false,
  height = INLINE_SIZE,
}: {
  name: string,
  style: TextStyle,
  isNested?: boolean,
  isWrapped?: boolean,
  isScaled?: boolean,
  height?: number,
}) {
  const [baseline, setBaseline] = React.useState<?number>();
  const [bottom, setBottom] = React.useState<?number>();
  const inlineRef = React.useRef<React.ElementRef<typeof View> | null>(null);
  React.useEffect(() => {
    inlineRef.current?.measure((x, y, width, measuredHeight) => {
      setBottom(measuredHeight > 0 ? y + measuredHeight : undefined);
      console.log(
        'INLINE_VIEW_FRAME',
        JSON.stringify({name, x, y, width, height: measuredHeight}),
      );
    });
  }, [baseline, name]);
  const error =
    baseline != null && bottom != null ? bottom - baseline : undefined;
  const content = (
    <>
      {'Hg '}
      <View ref={inlineRef} testID={name} style={[styles.inline, {height}]} />
      {' Hg'}
    </>
  );

  return (
    <View style={styles.sample}>
      <Text allowFontScaling={false} style={styles.label}>
        {name}
      </Text>
      <View style={styles.paragraph}>
        <Text
          allowFontScaling={isScaled}
          style={isNested ? styles.nestedParent : style}
          onTextLayout={event => {
            const lines = event.nativeEvent.lines;
            const line = lines[isWrapped ? 1 : 0];
            setBaseline(line.y + line.ascender);
            console.log('INLINE_VIEW_LINES', JSON.stringify({name, lines}));
          }}>
          {isWrapped ? 'First line\n' : ''}
          {isNested ? <Text style={style}>{content}</Text> : content}
        </Text>
        {baseline != null ? (
          <View
            pointerEvents="none"
            style={[styles.baseline, {top: baseline}]}
          />
        ) : undefined}
      </View>
      <Text allowFontScaling={false} style={styles.metrics}>
        {error == null
          ? baseline == null
            ? 'Measuring...'
            : 'View measurement unavailable'
          : `baseline ${baseline?.toFixed(3)} | bottom ${bottom?.toFixed(3)} | error ${error.toFixed(3)} pt`}
      </Text>
    </View>
  );
}

export function App(): React.Node {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text allowFontScaling={false} style={styles.heading}>
        Inline View Font
      </Text>
      <Text allowFontScaling={false} style={styles.description}>
        The blue box bottom should meet the red text baseline.
      </Text>
      {SAMPLES.map(sample => (
        <Sample key={sample.name} {...sample} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {padding: 16, backgroundColor: 'white'},
  heading: {fontSize: 24, fontWeight: 'bold', color: '#111827'},
  description: {fontSize: 13, marginVertical: 8, color: '#475569'},
  sample: {marginVertical: 8},
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 4,
  },
  paragraph: {position: 'relative', backgroundColor: '#f1f5f9'},
  inline: {width: INLINE_SIZE, backgroundColor: '#2563eb'},
  baseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#dc2626',
  },
  nestedParent: {fontFamily: HELVETICA, fontSize: 16},
  metrics: {
    fontSize: 10,
    color: '#334155',
    marginTop: 4,
    fontFamily: 'Menlo',
  },
});
