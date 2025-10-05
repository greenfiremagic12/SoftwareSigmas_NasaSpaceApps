import "package:flutter/material.dart";
import "package:ss_testing/pages/home.dart";
import "package:ss_testing/pages/default.dart";
import "package:ss_testing/pages/second.dart";

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Smart New York',
      
      initialRoute: '/home',
      routes: {
        '/': (context) => const Default(),
        '/home': (context) => const Home(),
        '/second': (context) => const Second(),
      },
    );
  }
}